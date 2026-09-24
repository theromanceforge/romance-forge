/**
 * Supabase reviews adapter — signed-in cloud path.
 * Fail soft: callers catch and fall back to guest-local UX.
 */

import { REVIEW_BODY_MAX } from './localStore.js';

/**
 * @typedef {{
 *   userId: string,
 *   storySlug: string,
 *   stars: number,
 *   body: string,
 *   displayName: string,
 *   spice: 'warm' | 'hot',
 *   approved?: boolean,
 *   hidden?: boolean,
 *   createdAt?: string | number,
 *   updatedAt?: string | number
 * }} ReviewRecord
 *
 * @typedef {{ average: number, count: number }} ReviewAggregate
 */

/**
 * @param {Partial<ReviewRecord> & Pick<ReviewRecord, 'userId' | 'storySlug' | 'stars' | 'spice'>} input
 * @returns {ReviewRecord}
 */
export function createReviewRecord(input) {
  const stars = Number(input.stars);
  const body = typeof input.body === 'string' ? input.body.slice(0, REVIEW_BODY_MAX) : '';
  const displayName =
    typeof input.displayName === 'string' && input.displayName.trim()
      ? input.displayName.trim().slice(0, 40)
      : 'Reader';
  return {
    userId: String(input.userId || ''),
    storySlug: String(input.storySlug || ''),
    stars,
    body,
    displayName,
    spice: input.spice === 'hot' ? 'hot' : 'warm',
    approved: input.approved !== false,
    hidden: Boolean(input.hidden),
    createdAt: input.createdAt ?? Date.now(),
    updatedAt: input.updatedAt ?? Date.now(),
  };
}

/**
 * @param {unknown} value
 * @returns {value is ReviewRecord}
 */
export function isValidReviewRecord(value) {
  if (!value || typeof value !== 'object') return false;
  const v = /** @type {Record<string, unknown>} */ (value);
  if (typeof v.userId !== 'string' || !v.userId) return false;
  if (typeof v.storySlug !== 'string' || !v.storySlug) return false;
  if (typeof v.stars !== 'number' || !Number.isInteger(v.stars) || v.stars < 1 || v.stars > 5) {
    return false;
  }
  if (typeof v.body !== 'string' || v.body.length > REVIEW_BODY_MAX) return false;
  if (typeof v.displayName !== 'string') return false;
  if (v.spice !== 'warm' && v.spice !== 'hot') return false;
  return true;
}

/**
 * @param {ReviewRecord} record
 * @returns {Record<string, unknown>}
 */
export function reviewRecordToRow(record) {
  const now =
    typeof record.updatedAt === 'number'
      ? new Date(record.updatedAt).toISOString()
      : String(record.updatedAt || new Date().toISOString());
  return {
    user_id: record.userId,
    story_slug: record.storySlug,
    stars: record.stars,
    body: record.body,
    display_name: record.displayName,
    spice: record.spice,
    approved: record.approved !== false,
    hidden: Boolean(record.hidden),
    updated_at: now,
  };
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {ReviewRecord | null}
 */
export function rowToReviewRecord(row) {
  if (!row || typeof row !== 'object') return null;
  const record = createReviewRecord({
    userId: String(row.user_id ?? ''),
    storySlug: String(row.story_slug ?? ''),
    stars: Number(row.stars),
    body: typeof row.body === 'string' ? row.body : '',
    displayName: typeof row.display_name === 'string' ? row.display_name : 'Reader',
    spice: row.spice === 'hot' ? 'hot' : 'warm',
    approved: row.approved !== false,
    hidden: Boolean(row.hidden),
    createdAt:
      typeof row.created_at === 'string' || typeof row.created_at === 'number'
        ? row.created_at
        : Date.now(),
    updatedAt:
      typeof row.updated_at === 'string' || typeof row.updated_at === 'number'
        ? row.updated_at
        : Date.now(),
  });
  return isValidReviewRecord(record) ? record : null;
}

/**
 * Average + count from a list of star ratings (public cloud only).
 * @param {number[]} starsList
 * @returns {ReviewAggregate}
 */
export function aggregateFromStars(starsList) {
  const valid = (starsList || []).filter(
    (n) => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5
  );
  if (!valid.length) return { average: 0, count: 0 };
  const sum = valid.reduce((a, b) => a + b, 0);
  const average = Math.round((sum / valid.length) * 10) / 10;
  return { average, count: valid.length };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export function createSupabaseReviewStore(client) {
  if (!client) {
    throw new Error('createSupabaseReviewStore requires a Supabase client');
  }

  return {
    /**
     * @param {ReviewRecord} record
     */
    async upsert(record) {
      if (!isValidReviewRecord(record)) {
        throw new Error('Invalid ReviewRecord');
      }
      const row = reviewRecordToRow(record);
      const { error } = await client.from('reviews').upsert(row, {
        onConflict: 'user_id,story_slug',
      });
      if (error) {
        throw new Error(`Cloud review failed: ${error.message}`);
      }
    },

    /**
     * @param {string} userId
     * @param {string} storySlug
     * @returns {Promise<ReviewRecord | null>}
     */
    async getOwn(userId, storySlug) {
      const { data, error } = await client
        .from('reviews')
        .select(
          'user_id, story_slug, stars, body, display_name, spice, approved, hidden, created_at, updated_at'
        )
        .eq('user_id', userId)
        .eq('story_slug', storySlug)
        .maybeSingle();
      if (error) {
        console.warn('[reviews] getOwn failed', error.message);
        return null;
      }
      return rowToReviewRecord(data);
    },

    /**
     * Public aggregate: approved && !hidden only (RLS enforces).
     * @param {string} storySlug
     * @returns {Promise<ReviewAggregate>}
     */
    async fetchAggregate(storySlug) {
      const { data, error } = await client
        .from('reviews')
        .select('stars')
        .eq('story_slug', storySlug)
        .eq('approved', true)
        .eq('hidden', false);
      if (error) {
        console.warn('[reviews] aggregate failed', error.message);
        return { average: 0, count: 0 };
      }
      const stars = (data || [])
        .map((r) => Number(r.stars))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5);
      return aggregateFromStars(stars);
    },

    /**
     * Latest public reviews for a story (Readers say strip).
     * @param {string} storySlug
     * @param {number} [limit=3]
     * @returns {Promise<ReviewRecord[]>}
     */
    async fetchLatest(storySlug, limit = 3) {
      const { data, error } = await client
        .from('reviews')
        .select(
          'user_id, story_slug, stars, body, display_name, spice, approved, hidden, created_at, updated_at'
        )
        .eq('story_slug', storySlug)
        .eq('approved', true)
        .eq('hidden', false)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) {
        console.warn('[reviews] latest failed', error.message);
        return [];
      }
      return (data || []).map(rowToReviewRecord).filter(Boolean);
    },
  };
}

/** No-network stub when Supabase is missing. */
export function createReviewStoreStub() {
  return {
    async upsert() {
      throw new Error('ReviewStore not configured');
    },
    async getOwn() {
      return null;
    },
    async fetchAggregate() {
      return { average: 0, count: 0 };
    },
    async fetchLatest() {
      return [];
    },
  };
}
