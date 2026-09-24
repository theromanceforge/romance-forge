/**
 * Review + CS UI helpers (HTML fragments + pure helpers).
 */

import { REVIEW_BODY_MAX, hasGuestReviewDecision, getGuestReview } from './localStore.js';
import { isGuest } from '../auth/session.js';

export const CS_EMAIL = 'theromanceforge@gmail.com';
export { REVIEW_BODY_MAX };

/**
 * @param {string} storyTitle
 * @returns {string}
 */
export function csMailtoHref(storyTitle) {
  const title = (storyTitle || 'Romance Forge').trim() || 'Romance Forge';
  const subject = `Romance Forge CS — ${title}`;
  return `mailto:${CS_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

/**
 * Show review prompt only on an ending, and only if no prior decision.
 * @param {{
 *   isEnding: boolean,
 *   hasDecision: boolean,
 *   isAuthFlow?: boolean,
 *   isAdInterstitial?: boolean,
 *   isFirstScene?: boolean,
 *   isSaveResume?: boolean
 * }} opts
 * @returns {boolean}
 */
export function shouldShowReviewPrompt(opts) {
  if (!opts || !opts.isEnding) return false;
  if (opts.hasDecision) return false;
  if (opts.isAuthFlow || opts.isAdInterstitial || opts.isFirstScene || opts.isSaveResume) {
    return false;
  }
  return true;
}

/**
 * @param {number} average
 * @param {number} count
 * @returns {string}
 */
export function formatCatalogStars(average, count) {
  if (!count || count < 1) return '';
  const avg = Number(average);
  const rounded = Number.isFinite(avg) ? Math.round(avg * 10) / 10 : 0;
  const label = count === 1 ? '1 review' : `${count} reviews`;
  return `★ ${rounded.toFixed(1)} · ${label}`;
}

/**
 * Escape for HTML attribute / text (local copy to avoid circular imports).
 * @param {string} str
 */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Catalog card star line — omit entirely when no public cloud reviews.
 * @param {{ average?: number, count?: number } | null | undefined} agg
 * @returns {string}
 */
export function renderCatalogStarLine(agg) {
  const count = agg?.count ?? 0;
  if (count < 1) return '';
  const text = formatCatalogStars(agg.average ?? 0, count);
  if (!text) return '';
  return `<span class="story-card-stars" data-testid="catalog-stars" aria-label="${esc(text)}">${esc(text)}</span>`;
}

/**
 * Compact “Readers say” strip — skip when empty.
 * @param {Array<{ displayName?: string, stars?: number, body?: string }>} reviews
 * @returns {string}
 */
export function renderReadersSayStrip(reviews) {
  const list = Array.isArray(reviews) ? reviews.filter(Boolean) : [];
  if (!list.length) return '';
  const items = list
    .slice(0, 3)
    .map((r) => {
      const name = esc(r.displayName || 'Reader');
      const stars = Math.min(5, Math.max(1, Number(r.stars) || 1));
      const body = typeof r.body === 'string' && r.body.trim() ? esc(r.body.trim()) : '';
      const starGlyphs = '★'.repeat(stars) + '☆'.repeat(5 - stars);
      return `<li class="readers-say-item">
        <span class="readers-say-stars" aria-hidden="true">${starGlyphs}</span>
        <span class="readers-say-name">${name}</span>
        ${body ? `<span class="readers-say-body">“${body}”</span>` : ''}
      </li>`;
    })
    .join('');
  return `<aside class="readers-say" data-testid="readers-say" aria-label="Readers say">
    <p class="readers-say-label">Readers say</p>
    <ul class="readers-say-list">${items}</ul>
  </aside>`;
}

/**
 * CS mailto link fragment.
 * @param {string} storyTitle
 * @param {{ className?: string, testId?: string, label?: string }} [opts]
 * @returns {string}
 */
export function renderCsMailtoLink(storyTitle, opts = {}) {
  const href = csMailtoHref(storyTitle);
  const className = opts.className || 'cs-mailto';
  const testId = opts.testId || 'cs-mailto';
  const label = opts.label || 'Contact CS';
  return `<a class="${esc(className)}" href="${esc(href)}" data-testid="${esc(testId)}">${esc(label)}</a>`;
}

/**
 * Ending review panel HTML.
 * @param {{
 *   storyId: string,
 *   storyTitle: string,
 *   spice: 'warm' | 'hot',
 *   defaultDisplayName?: string,
 *   decision?: import('./localStore.js').GuestReviewDecision | null,
 *   thankYouOnly?: boolean
 * }} opts
 * @returns {string}
 */
export function renderEndingReviewPanel(opts) {
  const storyTitle = opts.storyTitle || 'this story';
  const decision = opts.decision;
  const csLink = renderCsMailtoLink(storyTitle, {
    className: 'cs-mailto ending-cs',
    testId: 'ending-cs-mailto',
    label: 'Contact CS',
  });

  if (decision?.status === 'dismissed') {
    return `<div class="review-panel review-skipped" data-testid="review-panel" data-state="skipped">
      <p class="review-thanks">Whenever you’re ready — the forge keeps the light on.</p>
      <p class="review-cs">${csLink}</p>
    </div>`;
  }

  if (decision?.status === 'submitted' || opts.thankYouOnly) {
    const stars = decision?.status === 'submitted' ? decision.stars : 0;
    const starLine =
      stars >= 1
        ? `<p class="review-your-stars" data-testid="review-submitted-stars">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</p>`
        : '';
    return `<div class="review-panel review-done" data-testid="review-panel" data-state="submitted">
      <p class="review-thanks" data-testid="review-thanks">Thank you — your words keep the forge warm.</p>
      ${starLine}
      <p class="review-cs">${csLink}</p>
    </div>`;
  }

  const defaultName = (opts.defaultDisplayName || 'Reader').trim() || 'Reader';
  const starButtons = [1, 2, 3, 4, 5]
    .map(
      (n) => `<button
          type="button"
          class="review-star-btn"
          data-action="review-star"
          data-stars="${n}"
          data-testid="review-star-${n}"
          aria-label="${n} star${n === 1 ? '' : 's'}"
        >★</button>`
    )
    .join('');

  return `<div class="review-panel" data-testid="review-panel" data-state="prompt">
    <p class="review-prompt-title">How was ${esc(storyTitle)}?</p>
    <p class="review-prompt-hint">One quick rating helps the next reader find the heat.</p>
    <div class="review-stars" data-testid="review-stars" role="group" aria-label="Star rating">
      ${starButtons}
    </div>
    <input type="hidden" name="review-stars-value" value="" data-testid="review-stars-value" />
    <label class="review-label" for="review-body">Optional note <span class="review-optional">(≤${REVIEW_BODY_MAX})</span></label>
    <textarea
      id="review-body"
      class="review-body"
      data-testid="review-body"
      maxlength="${REVIEW_BODY_MAX}"
      rows="3"
      placeholder="Wine-and-smut takes welcome — keep it kind."
    ></textarea>
    <label class="review-label" for="review-display-name">Display name <span class="review-optional">(optional)</span></label>
    <input
      id="review-display-name"
      class="review-display-name"
      data-testid="review-display-name"
      type="text"
      maxlength="40"
      value="${esc(defaultName)}"
      placeholder="Reader"
    />
    <p class="review-error" data-testid="review-error" hidden></p>
    <div class="review-actions">
      <button type="button" class="btn secondary" data-action="review-submit" data-testid="review-submit">
        Submit
      </button>
      <button type="button" class="btn ghost" data-action="review-skip" data-testid="review-skip">
        Skip
      </button>
    </div>
    <p class="review-cs">${csLink}</p>
  </div>`;
}

/**
 * Resolve whether a guest/signed-in reader already decided for this story (local flag).
 * Cloud own-row is merged by the caller into hasDecision.
 * @param {string} storyId
 * @param {import('../auth/session.js').AuthSession | null | undefined} _auth
 * @param {Storage | null} [storage]
 */
export function localReviewDecision(storyId, _auth, storage) {
  return getGuestReview(storyId, storage);
}

/**
 * @param {string} storyId
 * @param {Storage | null} [storage]
 */
export function localHasReviewDecision(storyId, storage) {
  return hasGuestReviewDecision(storyId, storage);
}

/**
 * Default public display name.
 * @param {{ isGuest: boolean, playerName?: string, accountName?: string }} opts
 */
export function defaultReviewDisplayName(opts) {
  if (opts.accountName && String(opts.accountName).trim()) {
    return String(opts.accountName).trim().slice(0, 40);
  }
  if (opts.playerName && String(opts.playerName).trim()) {
    return String(opts.playerName).trim().slice(0, 40);
  }
  return opts.isGuest ? 'Reader' : 'Reader';
}

export { isGuest };
