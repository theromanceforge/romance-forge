/**
 * Supabase SaveStore adapter — maps SaveRecord ↔ public.saves rows.
 */

import { createSaveRecord, isValidSaveRecord } from './record.js';

/**
 * @param {Record<string, unknown>} row
 * @returns {import('./record.js').SaveRecord | null}
 */
export function rowToSaveRecord(row) {
  if (!row || typeof row !== 'object') return null;
  const path = row.path;
  const pathArr = Array.isArray(path)
    ? path.filter((id) => typeof id === 'string')
    : [];
  const updatedAt =
    typeof row.updated_at === 'string' || typeof row.updated_at === 'number'
      ? row.updated_at
      : Date.now();
  const record = createSaveRecord({
    userId: String(row.user_id ?? ''),
    storySlug: String(row.story_slug ?? ''),
    sceneId: String(row.scene_id ?? ''),
    path: pathArr,
    updatedAt,
  });
  return isValidSaveRecord(record) ? record : null;
}

/**
 * @param {import('./record.js').SaveRecord} record
 * @returns {Record<string, unknown>}
 */
export function saveRecordToRow(record) {
  const updatedAt =
    typeof record.updatedAt === 'number'
      ? new Date(record.updatedAt).toISOString()
      : String(record.updatedAt);
  return {
    user_id: record.userId,
    story_slug: record.storySlug,
    scene_id: record.sceneId,
    path: [...record.path],
    updated_at: updatedAt,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @returns {import('./store.js').SaveStore}
 */
export function createSupabaseSaveStore(client) {
  if (!client) {
    throw new Error('createSupabaseSaveStore requires a Supabase client');
  }

  return {
    async load(userId, storySlug) {
      const { data, error } = await client
        .from('saves')
        .select('user_id, story_slug, scene_id, path, updated_at')
        .eq('user_id', userId)
        .eq('story_slug', storySlug)
        .maybeSingle();
      if (error) {
        console.warn('[save] cloud load failed', error.message);
        return null;
      }
      return rowToSaveRecord(data);
    },

    async save(record) {
      if (!isValidSaveRecord(record)) {
        throw new Error('Invalid SaveRecord');
      }
      const row = saveRecordToRow(record);
      const { error } = await client.from('saves').upsert(row, {
        onConflict: 'user_id,story_slug',
      });
      if (error) {
        throw new Error(`Cloud save failed: ${error.message}`);
      }
    },

    async clear(userId, storySlug) {
      const { error } = await client
        .from('saves')
        .delete()
        .eq('user_id', userId)
        .eq('story_slug', storySlug);
      if (error) {
        console.warn('[save] cloud clear failed', error.message);
      }
    },
  };
}
