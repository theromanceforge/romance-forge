import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  reviewStorageKey,
  getGuestReview,
  setGuestReview,
  dismissGuestReview,
  hasGuestReviewDecision,
  clearGuestReview,
  isValidGuestReviewDecision,
  REVIEW_BODY_MAX,
} from '../src/reviews/localStore.js';
import {
  shouldShowReviewPrompt,
  csMailtoHref,
  formatCatalogStars,
  renderCatalogStarLine,
  renderEndingReviewPanel,
  renderCsMailtoLink,
  defaultReviewDisplayName,
  CS_EMAIL,
} from '../src/reviews/ui.js';
import {
  aggregateFromStars,
  createReviewRecord,
  isValidReviewRecord,
  reviewRecordToRow,
  rowToReviewRecord,
} from '../src/reviews/supabaseStore.js';
import { isEnding } from '../src/engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadMainSource() {
  return readFileSync(join(root, 'src/main.js'), 'utf8');
}

function memoryStorage() {
  /** @type {Record<string, string>} */
  const map = {};
  return {
    getItem(k) {
      return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null;
    },
    setItem(k, v) {
      map[k] = String(v);
    },
    removeItem(k) {
      delete map[k];
    },
  };
}

describe('shouldShowReviewPrompt — only after ending', () => {
  it('shows only when isEnding and no prior decision', () => {
    expect(shouldShowReviewPrompt({ isEnding: true, hasDecision: false })).toBe(true);
  });

  it('never mid-tree / mid-prose (non-ending)', () => {
    expect(shouldShowReviewPrompt({ isEnding: false, hasDecision: false })).toBe(false);
  });

  it('never after dismiss or submit', () => {
    expect(shouldShowReviewPrompt({ isEnding: true, hasDecision: true })).toBe(false);
  });

  it('forbidden over ads, first scene, auth, save/resume', () => {
    expect(
      shouldShowReviewPrompt({
        isEnding: true,
        hasDecision: false,
        isAdInterstitial: true,
      })
    ).toBe(false);
    expect(
      shouldShowReviewPrompt({
        isEnding: true,
        hasDecision: false,
        isFirstScene: true,
      })
    ).toBe(false);
    expect(
      shouldShowReviewPrompt({
        isEnding: true,
        hasDecision: false,
        isAuthFlow: true,
      })
    ).toBe(false);
    expect(
      shouldShowReviewPrompt({
        isEnding: true,
        hasDecision: false,
        isSaveResume: true,
      })
    ).toBe(false);
  });
});

describe('guest localStore roundtrip', () => {
  /** @type {ReturnType<typeof memoryStorage>} */
  let storage;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it('keys by storyId', () => {
    expect(reviewStorageKey('the-soft-alibi')).toBe('romanceForge.review.the-soft-alibi');
  });

  it('submits and reads back', () => {
    setGuestReview(
      {
        status: 'submitted',
        storyId: 'until-the-quiet-breaks',
        stars: 5,
        body: 'Wine night perfection.',
        displayName: 'Reader',
        spice: 'hot',
        createdAt: 1,
      },
      storage
    );
    const got = getGuestReview('until-the-quiet-breaks', storage);
    expect(got?.status).toBe('submitted');
    if (got?.status === 'submitted') {
      expect(got.stars).toBe(5);
      expect(got.body).toBe('Wine night perfection.');
      expect(got.spice).toBe('hot');
    }
    expect(hasGuestReviewDecision('until-the-quiet-breaks', storage)).toBe(true);
  });

  it('dismiss forever for that story', () => {
    dismissGuestReview('the-living-key', storage);
    const got = getGuestReview('the-living-key', storage);
    expect(got?.status).toBe('dismissed');
    expect(hasGuestReviewDecision('the-living-key', storage)).toBe(true);
    expect(hasGuestReviewDecision('other-story', storage)).toBe(false);
  });

  it('rejects invalid payloads', () => {
    expect(isValidGuestReviewDecision({ status: 'submitted', stars: 0 })).toBe(false);
    expect(() =>
      setGuestReview(
        /** @type {any} */ ({
          status: 'submitted',
          storyId: 'x',
          stars: 9,
          body: '',
          displayName: 'A',
          spice: 'warm',
          createdAt: 1,
        }),
        storage
      )
    ).toThrow();
  });

  it('clear removes decision', () => {
    dismissGuestReview('x', storage);
    clearGuestReview('x', storage);
    expect(getGuestReview('x', storage)).toBe(null);
  });
});

describe('catalog average math', () => {
  it('returns zero count when empty', () => {
    expect(aggregateFromStars([])).toEqual({ average: 0, count: 0 });
  });

  it('averages to one decimal', () => {
    expect(aggregateFromStars([5, 4, 5])).toEqual({ average: 4.7, count: 3 });
    expect(aggregateFromStars([3, 3, 3])).toEqual({ average: 3, count: 3 });
  });

  it('formatCatalogStars omits at zero and formats otherwise', () => {
    expect(formatCatalogStars(4.7, 0)).toBe('');
    expect(formatCatalogStars(4.7, 1)).toBe('★ 4.7 · 1 review');
    expect(formatCatalogStars(4.7, 3)).toBe('★ 4.7 · 3 reviews');
  });

  it('renderCatalogStarLine omits markup when no public reviews', () => {
    expect(renderCatalogStarLine(null)).toBe('');
    expect(renderCatalogStarLine({ average: 5, count: 0 })).toBe('');
    expect(renderCatalogStarLine({ average: 4.5, count: 2 })).toMatch(/catalog-stars/);
    expect(renderCatalogStarLine({ average: 4.5, count: 2 })).toMatch(/★ 4\.5/);
  });
});

describe('mailto href shape', () => {
  it('uses CS inbox and prefilled subject with story title', () => {
    const href = csMailtoHref('The Soft Alibi');
    expect(href.startsWith(`mailto:${CS_EMAIL}?subject=`)).toBe(true);
    expect(href).toContain(encodeURIComponent('Romance Forge CS — The Soft Alibi'));
  });

  it('renderCsMailtoLink embeds href', () => {
    const html = renderCsMailtoLink('Until the Quiet Breaks', {
      testId: 'footer-cs-mailto',
      label: 'Contact CS',
    });
    expect(html).toContain('data-testid="footer-cs-mailto"');
    expect(html).toContain(encodeURIComponent('Romance Forge CS — Until the Quiet Breaks'));
  });
});

describe('ending review panel HTML', () => {
  it('prompt has stars, body, submit, skip', () => {
    const html = renderEndingReviewPanel({
      storyId: 'until-the-quiet-breaks',
      storyTitle: 'Until the Quiet Breaks',
      spice: 'warm',
      defaultDisplayName: 'Reader',
      decision: null,
    });
    expect(html).toMatch(/data-testid="review-panel"/);
    expect(html).toMatch(/data-testid="review-star-5"/);
    expect(html).toMatch(/data-testid="review-body"/);
    expect(html).toMatch(/data-testid="review-submit"/);
    expect(html).toMatch(/data-testid="review-skip"/);
    expect(html).toMatch(/data-testid="ending-cs-mailto"/);
    expect(html).toContain(String(REVIEW_BODY_MAX));
  });

  it('submitted state shows thanks, not form', () => {
    const html = renderEndingReviewPanel({
      storyId: 'x',
      storyTitle: 'X',
      spice: 'hot',
      decision: {
        status: 'submitted',
        storyId: 'x',
        stars: 4,
        body: '',
        displayName: 'Reader',
        spice: 'hot',
        createdAt: 1,
      },
    });
    expect(html).toMatch(/data-state="submitted"/);
    expect(html).toMatch(/review-thanks/);
    expect(html).not.toMatch(/data-testid="review-submit"/);
  });
});

describe('review record + row mapping', () => {
  it('creates valid records and maps to/from rows', () => {
    const record = createReviewRecord({
      userId: '11111111-1111-1111-1111-111111111111',
      storySlug: 'the-soft-alibi',
      stars: 5,
      body: 'Soft and sharp.',
      displayName: 'Mara',
      spice: 'warm',
    });
    expect(isValidReviewRecord(record)).toBe(true);
    const row = reviewRecordToRow(record);
    expect(row.user_id).toBe(record.userId);
    expect(row.story_slug).toBe('the-soft-alibi');
    expect(row.approved).toBe(true);
    expect(row.hidden).toBe(false);
    const back = rowToReviewRecord({
      ...row,
      created_at: '2026-09-24T00:00:00Z',
    });
    expect(back?.stars).toBe(5);
    expect(back?.displayName).toBe('Mara');
  });
});

describe('default display name', () => {
  it('guest defaults to Reader when no name', () => {
    expect(defaultReviewDisplayName({ isGuest: true })).toBe('Reader');
  });

  it('prefers player / account name', () => {
    expect(
      defaultReviewDisplayName({ isGuest: true, playerName: 'Eleanor' })
    ).toBe('Eleanor');
    expect(
      defaultReviewDisplayName({
        isGuest: false,
        accountName: 'Mara',
        playerName: 'Eleanor',
      })
    ).toBe('Mara');
  });
});

describe('main wiring — ending-only review UI + CS', () => {
  it('review panel lives inside ending-block only', () => {
    const src = loadMainSource();
    expect(src).toMatch(/ending-block[\s\S]*reviewHtml|renderEndingReviewPanel/);
    expect(src).toMatch(/shouldShowReviewPrompt/);
    expect(src).toMatch(/data-action="review-submit"/);
    expect(src).toMatch(/data-action="review-skip"/);
    // Must not attach review UI to choice path
    const choiceChunk = src.slice(
      src.indexOf('choice-prompt'),
      src.indexOf('choice-prompt') + 800
    );
    expect(choiceChunk).not.toMatch(/review-panel/);
  });

  it('footer + ending expose CS mailto helpers', () => {
    const src = loadMainSource();
    expect(src).toMatch(/footer-cs-mailto|renderCsMailtoLink/);
    expect(src).toMatch(/ending-cs-mailto|renderEndingReviewPanel/);
    expect(src).toMatch(/CS_EMAIL|renderCsMailtoLink/);
    expect(readFileSync(join(root, 'src/reviews/ui.js'), 'utf8')).toContain('theromanceforge@gmail.com');
  });

  it('catalog cards use public aggregate star line', () => {
    const src = loadMainSource();
    expect(src).toMatch(/renderCatalogStarLine\(state\.reviewAggregates/);
  });

  it('SQL schema script exists for staff apply', () => {
    const sql = readFileSync(join(root, 'scripts/apply-reviews-schema.sql'), 'utf8');
    expect(sql).toMatch(/create table if not exists public\.reviews/);
    expect(sql).toMatch(/approved boolean not null default true/);
    expect(sql).toMatch(/hidden boolean not null default false/);
    expect(sql).toMatch(/reviews_select_public/);
  });
});

describe('engine isEnding still gates endings', () => {
  it('ending flag or empty choices', () => {
    expect(isEnding({ id: 'e', layer: 10, text: 'x', ending: true })).toBe(true);
    expect(isEnding({ id: 'e', layer: 10, text: 'x', choices: [] })).toBe(true);
    expect(
      isEnding({
        id: 'm',
        layer: 1,
        text: 'x',
        choices: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
      })
    ).toBe(false);
  });
});
