import { getStory, STORIES, story as defaultStory } from './stories/index.js';
import {
  substituteName,
  getScene,
  getSceneText,
  getChoiceText,
  getChoices,
  isEnding,
  resolveChoice,
  getSceneArtPath,
} from './engine.js';
import { createGuestSession, isGuest, saveUserId, GUEST_USER_ID } from './auth/session.js';
import {
  CLOUD_AUTH_NOT_CONFIGURED,
  handoffGuestToMockAccount,
  isAuthMockEnabled,
  isMockAuthAllowed,
  loadPersistedAuthSession,
  MOCK_USER_ID,
  persistAuthSession,
  setAuthMockEnabled,
} from './auth/mock.js';
import {
  fetchAuthSession,
  handoffGuestToCloudAccount,
  isSupabaseConfigured,
  onAuthSessionChange,
  signInWithPassword,
  signOutCloud,
  signUpWithPassword,
} from './auth/cloud.js';
import { getSupabaseClient } from './auth/supabaseClient.js';
import { renderAuthHeaderControl, renderAuthModal } from './auth/ui.js';
import { appendPath, createSaveRecord, trimPathToScene } from './save/record.js';
import {
  createLocalSaveStore,
  createCloudSaveStoreStub,
  createSupabaseSaveStore,
} from './save/store.js';
import { shouldShowSavePrompt, markSavePromptDismissed } from './save/prompt.js';
import { resumeSceneLabel } from './save/resumeLabel.js';
import { getAdsConfig } from './ads/config.js';
import { shouldShowInterstitial, isEndingDestination } from './ads/shouldShow.js';
import {
  selectWhatIfCards,
  renderWhatIfMapHtml,
  renderWhatIfCompactHtml,
  pathForReplayFrom,
  saveLastFinished,
  loadLastFinished,
  clearLastFinished,
} from './whatIf.js';
import { showInterstitial, ensureAdSenseScript } from './ads/interstitial.js';
import {
  bumpAdsStat,
  getStoryAdsShown,
  bumpStoryAdsShown,
  resetStoryAdsShown,
} from './ads/stats.js';
import {
  getGuestReview,
  setGuestReview,
  dismissGuestReview,
  hasGuestReviewDecision,
  REVIEW_BODY_MAX,
} from './reviews/localStore.js';
import {
  createSupabaseReviewStore,
  createReviewStoreStub,
  createReviewRecord,
  aggregateFromStars,
} from './reviews/supabaseStore.js';
import { assetUrl } from './assetUrl.js';
import { track, bindOutboundTracking } from './analytics.js';

/** Public brand sprite — base-aware so Pages does not 404 at domain root. */
document.documentElement.style.setProperty(
  '--brand-icons-grid',
  `url("${assetUrl('/brand/icons-grid.png')}")`
);

import {
  shouldShowReviewPrompt,
  renderEndingReviewPanel,
  renderCatalogStarLine,
  renderReadersSayStrip,
  renderCsMailtoLink,
  csMailtoHref,
  defaultReviewDisplayName,
  CS_EMAIL,
} from './reviews/ui.js';

const SPICE_KEY = 'romanceForge.spice';
/** Friendly default heroine name: the name step is optional (one-tap Begin). */
export const DEFAULT_PLAYER_NAME = 'Rose';

/** Typed name, or the friendly default when the field is left empty. */
function resolvePlayerName(raw) {
  const name = String(raw ?? '').trim();
  return name || DEFAULT_PLAYER_NAME;
}

/** Analytics only records a name the reader actually chose (not the default). */
function chosenNameForAnalytics(name) {
  return name === DEFAULT_PLAYER_NAME ? '' : name;
}
const STORY_KEY = 'romanceForge.storyId';

const localSaveStore = createLocalSaveStore();
const supabaseClient = getSupabaseClient();
const cloudConfigured = Boolean(supabaseClient) && isSupabaseConfigured();
/** Live cloud when env present; stub otherwise (tests / no env). */
const cloudSaveStore = supabaseClient
  ? createSupabaseSaveStore(supabaseClient)
  : createCloudSaveStoreStub();
const cloudReviewStore = supabaseClient
  ? createSupabaseReviewStore(supabaseClient)
  : createReviewStoreStub();

/** @returns {import('./engine.js').Story} */
function activeStory() {
  const id = state?.storyId;
  if (id && STORIES[id]) return STORIES[id];
  return defaultStory;
}

/** Brand cover path for a story slug. */
function storyCoverPath(storyId) {
  const id = storyId || defaultStory.id;
  return assetUrl(`/brand/cover-${id}.png`);
}

function persistGuestProgress(partial = {}) {
  const sceneId = partial.sceneId ?? state.sceneId;
  const path = partial.path ?? state.path;
  const storySlug = partial.storyId ?? state.storyId ?? defaultStory.id;
  if (!sceneId || !path?.length) return;
  const record = createSaveRecord({
    userId: saveUserId(state.auth),
    storySlug,
    sceneId,
    path,
  });
  localSaveStore.save(record);
  // Authenticated: also persist to cloud (fire-and-forget; guest path unchanged).
  if (!isGuest(state.auth) && cloudConfigured) {
    Promise.resolve(cloudSaveStore.save(record)).catch((err) => {
      console.warn('[save] cloud persist failed', err?.message || err);
    });
  }
}

/**
 * Prefer cloud (via local userId cache seeded on login) over guest local when authenticated.
 * Sync for landing resume UI; cloud is refreshed async on auth.
 */
function loadGuestSave(storySlug = state.storyId || defaultStory.id) {
  if (state.cloudResume && state.cloudResume.storySlug === storySlug) {
    return state.cloudResume;
  }
  const uid = saveUserId(state.auth);
  const own = localSaveStore.load(uid, storySlug);
  if (own) return own;
  if (!isGuest(state.auth)) {
    return localSaveStore.load(GUEST_USER_ID, storySlug);
  }
  return null;
}

async function refreshCloudResume(storySlug = state.storyId || defaultStory.id) {
  if (isGuest(state.auth) || !cloudConfigured) {
    if (state.cloudResume) setState({ cloudResume: null });
    return;
  }
  try {
    const remote = await cloudSaveStore.load(state.auth.userId, storySlug);
    if (remote) {
      localSaveStore.save(remote);
      setState({ cloudResume: remote });
      return;
    }
  } catch (err) {
    console.warn('[save] cloud resume load failed', err?.message || err);
  }
  const local = localSaveStore.load(state.auth.userId, storySlug);
  setState({ cloudResume: local });
}

async function applyAuthenticatedSession(session, statusMessage = '') {
  const storySlug = state.storyId || defaultStory.id;
  const inProgress =
    state.path?.length && state.sceneId
      ? { sceneId: state.sceneId, path: state.path }
      : null;
  try {
    await handoffGuestToCloudAccount({
      localStore: localSaveStore,
      cloudStore: cloudConfigured ? cloudSaveStore : null,
      storySlug,
      userId: session.userId,
      inProgress,
    });
  } catch (err) {
    console.warn('[auth] guest handoff failed', err?.message || err);
  }
  persistAuthSession(session);
  setState({
    auth: session,
    authModalOpen: false,
    authStatusMessage: statusMessage,
    savePromptVisible: false,
  });
  await refreshCloudResume(storySlug);
}

function maybeOfferSavePrompt(trigger) {
  if (
    !shouldShowSavePrompt({
      session: state.auth,
      alreadyShown: state.savePromptShown,
    })
  ) {
    return;
  }
  state = {
    ...state,
    savePromptShown: true,
    savePromptVisible: true,
    savePromptTrigger: trigger,
  };
}


function clearGuestSave(storySlug = state.storyId || defaultStory.id) {
  const clear = localSaveStore.clear;
  if (typeof clear === 'function') {
    clear.call(localSaveStore, saveUserId(state.auth), storySlug);
  }
}

function openAuthModal(tab = 'signin', statusMessage = '') {
  setState({
    authModalOpen: true,
    authModalTab: tab === 'signup' ? 'signup' : 'signin',
    authStatusMessage: statusMessage,
  });
}

function closeAuthModal() {
  setState({ authModalOpen: false, authStatusMessage: '' });
}

function authModalHtml() {
  return renderAuthModal({
    open: state.authModalOpen,
    tab: state.authModalTab,
    session: state.auth,
    statusMessage: state.authStatusMessage,
    mockEnabled: isAuthMockEnabled(),
    cloudConfigured,
  });
}

function authHeaderHtml() {
  return renderAuthHeaderControl({ session: state.auth });
}

/**
 * Local mock handoff: copy guest SaveRecord → mock-user, set AuthSession.
 * Pure local — no network.
 */
function runMockAccountHandoff() {
  const storySlug = state.storyId || defaultStory.id;
  const { session, copied } = handoffGuestToMockAccount({
    localStore: localSaveStore,
    storySlug,
  });
  // Also copy in-progress reader path if guest has no stored record yet.
  if (!copied && state.path?.length && state.sceneId) {
    const record = createSaveRecord({
      userId: MOCK_USER_ID,
      storySlug,
      sceneId: state.sceneId,
      path: state.path,
    });
    localSaveStore.save(record);
  }
  persistAuthSession(session);
  setState({
    auth: session,
    authModalOpen: false,
    authStatusMessage: '',
    savePromptVisible: false,
  });
}


/** Persist guest progress on tab hide/close; offer save prompt flags for next landing (no alert). */
function handleGuestPageHide() {
  if (state.view !== 'reader') return;
  persistGuestProgress();
  if (isGuest(state.auth)) maybeOfferSavePrompt('exit');
}

/** Closing line on the ending screen when a story has no `endingLine` of its own. */
const DEFAULT_ENDING_LINE = 'Your story ends here — for now.';

/** @type {{ id: string, title: string, blurb: string, available: boolean, accentSrc?: string, coverSrc: string, coverAlt: string, hook: string, pull: string, chips: string[], badge: string, endingLine?: string, whatIf?: Array<{ sceneId: string, choiceIndex?: number, target?: string, tease?: string }> }} */
const CATALOG = [
  {
    id: 'until-the-quiet-breaks',
    title: 'Until the Quiet Breaks',
    blurb:
      'A complete romance: 10 endings, Warm & Hot. Fifteen years after leaving Somerton, Henry’s letter brings you home—John Shaw still keeps the diner with the blue door. Choose your path and let the quiet break.',
    available: true,
    accentSrc: assetUrl('/brand/cover-until-the-quiet-breaks-square.png'),
    coverSrc: assetUrl('/brand/cover-until-the-quiet-breaks.png'),
    coverAlt: 'Until the Quiet Breaks — rainy Somerton station woodcut',
    hook: 'Somerton rain. John Shaw still waiting. A quiet that wants to break— on your terms.',
    pull: 'The blue door still waits in the rain.',
    chips: ['Somerton rain', 'John Shaw', '10 endings'],
    badge: '10 endings · Warm & Hot',
    endingLine: "The quiet isn't done with you.",
  },
  {
    id: 'what-the-sister-kept',
    title: 'What the Sister Kept',
    blurb:
      'Harborwick mystery romance: cold case, missing sister, Detective William Akers. What she kept could reopen everything—or destroy what’s left of her family.',
    available: true,
    accentSrc: assetUrl('/brand/cover-what-the-sister-kept-square.png'),
    coverSrc: assetUrl('/brand/cover-what-the-sister-kept.png'),
    coverAlt: 'What the Sister Kept — Harborwick fog and cold-case romance',
    hook: 'Harborwick fog. William Akers at the door. A charm that might be Renny’s—and a secret she kept.',
    pull: 'Hope and dread share the doorway.',
    chips: ['Harborwick', 'William Akers', 'Cold case'],
    badge: 'Mystery · Warm & Hot',
  },
  {
    id: 'the-living-key',
    title: 'The Living Key',
    blurb:
      'A complete magical romance: 10 endings, Warm & Hot. Ashmere Collegium’s wards are singing wrong—Cassian Rook is assigned your handler, and a living key could remake the cliff or claim your throat.',
    available: true,
    accentSrc: assetUrl('/brand/cover-the-living-key-square.png'),
    coverSrc: assetUrl('/brand/cover-the-living-key.png'),
    coverAlt: 'The Living Key — Ashmere wards woodcut',
    hook: 'Ashmere Collegium. Cassian Rook. The wards are singing wrong.',
    pull: 'A living key. A dying ward-song. A choice that remakes the cliff.',
    chips: ['Ashmere', 'Cassian Rook', '10 endings'],
    badge: '10 endings · Warm & Hot / Magical romance',
  },
  {
    id: 'the-soft-alibi',
    title: 'The Soft Alibi',
    blurb:
      'A complete glass-tower romance: 10 endings, Warm & Hot. Across the hall from Nolan Greer’s Crownspire penthouse, you are the neighbor-mistress—and Detective Imani Brooks wants to know where Vivienne went. Wine, heat, and the softest alibi money can buy.',
    available: true,
    accentSrc: assetUrl('/brand/cover-the-soft-alibi-square.png'),
    coverSrc: assetUrl('/brand/cover-the-soft-alibi.png'),
    coverAlt: 'The Soft Alibi — Crownspire glass and missing-wife heat',
    hook: 'Crownspire glass. Nolan Greer across the hall. Brooks asking where Mrs. Greer went.',
    pull: 'Wine on marble. Unused perfume. The softest alibi money can buy.',
    chips: ['Crownspire', 'Nolan Greer', '10 endings'],
    badge: '10 endings · Warm & Hot / Glass-tower mystery',
  },
];

function catalogEntry(storyId) {
  return CATALOG.find((c) => c.id === storyId) || CATALOG.find((c) => c.available) || CATALOG[0];
}

/** Per-story ending-screen line (optional CATALOG `endingLine`), else the neutral default. */
function endingLineFor(storyId) {
  const line = CATALOG.find((c) => c.id === storyId)?.endingLine;
  return typeof line === 'string' && line.trim() ? line.trim() : DEFAULT_ENDING_LINE;
}

function entryTitleFor(storyId) {
  return catalogEntry(storyId)?.title || 'Romance Forge';
}

const app = document.getElementById('app');

function readStoredSpice() {
  try {
    const v = sessionStorage.getItem(SPICE_KEY);
    if (v === 'warm' || v === 'hot') return v;
  } catch {
    /* ignore */
  }
  return '';
}

function readStoredStoryId() {
  // Share links: <base><story-id>/ (static page with that story's OG tags).
  const fromPath = (location.pathname || '').split('/').filter(Boolean).pop();
  if (fromPath && CATALOG.some((c) => c.id === fromPath && c.available)) return fromPath;
  try {
    const v = sessionStorage.getItem(STORY_KEY);
    if (v && CATALOG.some((c) => c.id === v && c.available)) return v;
  } catch {
    /* ignore */
  }
  return CATALOG.find((c) => c.available)?.id || '';
}

/** @type {{ view: 'landing' | 'reader', playerName: string, sceneId: string, previousSceneId: string, spice: '' | 'warm' | 'hot', storyId: string, path: string[], whatIfHighlightId: string, auth: import('./auth/session.js').AuthSession, savePromptShown: boolean, savePromptVisible: boolean, savePromptTrigger: '' | 'choice' | 'exit', authModalOpen: boolean, authModalTab: 'signin' | 'signup', authStatusMessage: string, _pendingResume: boolean, _pendingWhatIfReplay: null | { sceneId: string, path: string[], highlightId: string }, _transitioning?: boolean }} */
let state = {
  view: 'landing',
  playerName: '',
  sceneId: defaultStory.startSceneId,
  previousSceneId: '',
  spice: readStoredSpice(),
  storyId: readStoredStoryId(),
  path: [],
  whatIfHighlightId: '',
  auth: loadPersistedAuthSession(),
  savePromptShown: false,
  savePromptVisible: false,
  savePromptTrigger: '',
  authModalOpen: false,
  authModalTab: 'signin',
  authStatusMessage: '',
  _pendingResume: false,
  /** @type {null | { sceneId: string, path: string[], highlightId: string }} */
  _pendingWhatIfReplay: null,
  /** @type {import('./save/record.js').SaveRecord | null} */
  cloudResume: null,
  /** @type {Record<string, { average: number, count: number }>} */
  reviewAggregates: {},
  /** @type {import('./reviews/supabaseStore.js').ReviewRecord[]} */
  readersSay: [],
  /** Selected star count while composing an ending review (1–5 or 0). */
  reviewDraftStars: 0,
};

function setState(partial) {
  state = { ...state, ...partial };
  if (partial.spice === 'warm' || partial.spice === 'hot') {
    try {
      sessionStorage.setItem(SPICE_KEY, partial.spice);
    } catch {
      /* ignore */
    }
  }
  if (partial.storyId) {
    try {
      sessionStorage.setItem(STORY_KEY, partial.storyId);
    } catch {
      /* ignore */
    }
  }
  render();
}


async function refreshReviewAggregates() {
  if (!cloudConfigured) return;
  const ids = CATALOG.filter((c) => c.available).map((c) => c.id);
  /** @type {Record<string, { average: number, count: number }>} */
  const next = { ...state.reviewAggregates };
  await Promise.all(
    ids.map(async (id) => {
      try {
        const agg = await cloudReviewStore.fetchAggregate(id);
        next[id] = agg;
      } catch (err) {
        console.warn('[reviews] aggregate', id, err?.message || err);
      }
    })
  );
  setState({ reviewAggregates: next });
}

async function refreshReadersSay(storySlug = state.storyId || defaultStory.id) {
  if (!cloudConfigured || !storySlug) {
    if (state.readersSay?.length) setState({ readersSay: [] });
    return;
  }
  try {
    const latest = await cloudReviewStore.fetchLatest(storySlug, 3);
    setState({ readersSay: latest });
  } catch (err) {
    console.warn('[reviews] readers say failed', err?.message || err);
  }
}

const _reviewHydrateInflight = new Set();
function maybeHydrateCloudReview(storySlug = state.storyId || defaultStory.id) {
  if (!storySlug || isGuest(state.auth) || !cloudConfigured) return;
  if (hasGuestReviewDecision(storySlug)) return;
  if (_reviewHydrateInflight.has(storySlug)) return;
  _reviewHydrateInflight.add(storySlug);
  Promise.resolve(cloudReviewStore.getOwn(state.auth.userId, storySlug))
    .then((own) => {
      if (!own || hasGuestReviewDecision(storySlug)) return;
      setGuestReview({
        status: 'submitted',
        storyId: storySlug,
        stars: own.stars,
        body: own.body || '',
        displayName: own.displayName || 'Reader',
        spice: own.spice === 'hot' ? 'hot' : 'warm',
        createdAt: Date.now(),
      });
      setState({ reviewDraftStars: 0 });
    })
    .catch((err) => {
      console.warn('[reviews] hydrate own failed', err?.message || err);
    })
    .finally(() => {
      _reviewHydrateInflight.delete(storySlug);
    });
}

function submitEndingReview() {
  const storyId = state.storyId || defaultStory.id;
  const stars = state.reviewDraftStars;
  const errEl = app.querySelector('[data-testid="review-error"]');
  if (!stars || stars < 1 || stars > 5) {
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = 'Pick a star rating (1–5) to submit.';
    }
    return;
  }
  const bodyEl = /** @type {HTMLTextAreaElement | null} */ (
    app.querySelector('[data-testid="review-body"]')
  );
  const nameEl = /** @type {HTMLInputElement | null} */ (
    app.querySelector('[data-testid="review-display-name"]')
  );
  const body = (bodyEl?.value || '').trim().slice(0, REVIEW_BODY_MAX);
  const spice = state.spice === 'hot' ? 'hot' : 'warm';
  const displayName = defaultReviewDisplayName({
    isGuest: isGuest(state.auth),
    playerName: nameEl?.value || state.playerName,
  });

  const guestRecord = {
    status: /** @type {const} */ ('submitted'),
    storyId,
    stars,
    body,
    displayName,
    spice,
    createdAt: Date.now(),
  };
  setGuestReview(guestRecord);
  track('review_submitted', {
    storyId,
    spice,
    meta: { stars, guest: isGuest(state.auth) },
  });

  if (!isGuest(state.auth) && cloudConfigured) {
    const record = createReviewRecord({
      userId: state.auth.userId,
      storySlug: storyId,
      stars,
      body,
      displayName,
      spice,
    });
    Promise.resolve(cloudReviewStore.upsert(record))
      .then(() => refreshReviewAggregates())
      .catch((err) => {
        console.warn('[reviews] cloud upsert failed', err?.message || err);
      });
  }

  setState({ reviewDraftStars: 0 });
}

function renderLanding() {
  const spice = state.spice;
  const entry = catalogEntry(state.storyId);
  const coverSrc = entry.coverSrc || storyCoverPath(entry.id);
  // Quiet Breaks scene1 art remains a known public asset for tests/branding.
  // '/art/until-the-quiet-breaks/scene1.png'
  const current = activeStory();
  const guestSave = loadGuestSave(state.storyId || defaultStory.id);
  const resumeLabel = guestSave?.sceneId
    ? resumeSceneLabel(guestSave.sceneId, current)
    : '';
  const resumeHtml =
    guestSave && guestSave.sceneId && guestSave.path?.length
      ? `<div class="resume-offer" data-testid="resume-offer">
              <p class="resume-hint">You left off at ${escapeHtml(resumeLabel)}.</p>
              <button type="button" class="btn secondary" data-action="resume" data-testid="resume-btn">
                Continue where you left off
              </button>
              <button type="button" class="btn ghost start-fresh" data-action="start-fresh" data-testid="start-fresh-btn">
                Start fresh
              </button>
            </div>`
      : '';
  // In flow above the story picker (not pinned) so it can't sit under the sticky Begin bar.
  const landingSavePromptHtml = state.savePromptVisible
    ? `<aside class="save-prompt save-prompt--inline save-prompt--landing" data-testid="save-prompt" role="status">
         <p>Save your place — guest progress stays on this browser.</p>
         <div class="save-prompt-actions">
           <button type="button" class="btn secondary" data-action="open-auth-save" data-testid="save-across-devices">
             Save across devices
           </button>
           <button type="button" class="btn ghost" data-action="dismiss-save-prompt" data-testid="dismiss-save-prompt">
             Not now
           </button>
         </div>
       </aside>`
    : '';

  const lastFinished = loadLastFinished();
  const lastFinishedValid =
    lastFinished &&
    CATALOG.some((c) => c.id === lastFinished.storyId && c.available);
  let landingWhatIfHtml = '';
  if (lastFinishedValid) {
    const finishedStory = getStory(lastFinished.storyId);
    const finishedEntry = catalogEntry(lastFinished.storyId);
    const compactCards = selectWhatIfCards(finishedStory, lastFinished.path, {
      spice: lastFinished.spice === 'hot' ? 'hot' : 'warm',
      max: 2,
      overrides: Array.isArray(finishedEntry?.whatIf) ? finishedEntry.whatIf : undefined,
    });
    landingWhatIfHtml = renderWhatIfCompactHtml(compactCards, {
      escapeHtml,
      storyTitle: entryTitleFor(lastFinished.storyId),
    });
  }

  const pickerHtml = `
        <fieldset class="story-picker cover-picker" data-testid="story-picker">
          <legend>Choose a story <span class="req" aria-hidden="true">*</span></legend>
          <div class="story-grid" role="list">
            ${CATALOG.map((c) => {
              const selected = state.storyId === c.id;
              const disabled = !c.available;
              const art = c.accentSrc
                ? `<img class="story-card-art" src="${escapeHtml(c.accentSrc)}" alt="" width="52" height="52" />`
                : `<span class="story-card-placeholder" aria-hidden="true">✦</span>`;
              return `
              <button
                type="button"
                class="story-card${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}"
                data-action="pick-story"
                data-story-id="${escapeHtml(c.id)}"
                data-testid="story-${escapeHtml(c.id)}"
                ${disabled ? 'disabled' : ''}
                ${selected ? 'aria-pressed="true"' : 'aria-pressed="false"'}
              >
                ${art}
                <span class="story-card-body">
                  <span class="story-card-title">${escapeHtml(c.title)}</span>
                  ${selected ? `<span class="story-card-blurb">${escapeHtml(c.blurb)}</span>` : ''}
                  ${renderCatalogStarLine(state.reviewAggregates[c.id])}
                </span>
              </button>`;
            }).join('')}
          </div>
        </fieldset>`;

  // Keep pre-story copy to the minimum: one line of what this is, then the picker.
  const forgeStripHtml = `
      <section class="forge-strip forge-strip--compact" data-testid="forge-strip" aria-label="About Romance Forge">
        <p class="forge-strip-what">Interactive romance: you read by choosing.</p>
      </section>`;

  return `
    <main class="page landing cover-landing" data-testid="landing">
      <div class="landing-room" aria-hidden="true"></div>
      ${forgeStripHtml}
      ${landingSavePromptHtml}
      ${landingWhatIfHtml}
      <section class="cover-hero" aria-labelledby="story-heading" data-testid="start-reading">
        <div class="cover">
          <span class="cover-spine" aria-hidden="true"></span>
          <span class="cover-edge" aria-hidden="true"></span>
          <img
            class="cover-art"
            src="${escapeHtml(coverSrc)}"
            alt="${escapeHtml(entry.coverAlt || entry.title)}"
            width="1024"
            height="1536"
            data-testid="story-cover"
          />
          <div class="cover-grain" aria-hidden="true"></div>
          <div class="cover-shade" aria-hidden="true"></div>
          <div class="cover-overlay">
            <div class="cover-mark">
              <img
                class="cover-logo"
                src="${assetUrl('/brand/logo-heart-anvil.png')}"
                alt=""
                width="36"
                height="36"
                aria-hidden="true"
              />
              <span class="cover-wordmark">Romance Forge</span>
              ${authHeaderHtml()}
            </div>

            ${pickerHtml}

            <h1 id="story-heading" class="cover-title">${escapeHtml(entry.title)}</h1>
            <p class="cover-hook">
              ${escapeHtml(entry.hook || '')}
            </p>
            <span class="story-badge live cover-badge">${escapeHtml(entry.badge || '')}</span>
            ${renderReadersSayStrip(state.readersSay)}

            <fieldset class="spice-meter cover-spice" data-testid="spice-meter">
              <legend class="visually-hidden">Spice level</legend>
              <div class="spice-options" role="radiogroup" aria-label="Spice level">
                <label class="spice-option${spice === 'warm' ? ' selected' : ''}">
                  <input
                    type="radio"
                    name="spice"
                    value="warm"
                    data-testid="spice-warm"
                    ${spice === 'warm' ? 'checked' : ''}
                    required
                  />
                  <span class="spice-label">Warm</span>
                  <span class="spice-desc">Yearning · soft-close emotional heat</span>
                </label>
                <label class="spice-option${spice === 'hot' ? ' selected' : ''}">
                  <input
                    type="radio"
                    name="spice"
                    value="hot"
                    data-testid="spice-hot"
                    ${spice === 'hot' ? 'checked' : ''}
                  />
                  <span class="spice-label">Hot</span>
                  <span class="spice-desc">Explicit body-POV smut</span>
                </label>
              </div>
            </fieldset>

            <form id="start-form" class="start-form cover-start" novalidate>
              <label for="player-name" class="visually-hidden">Your name</label>
              <input
                id="player-name"
                name="playerName"
                type="text"
                maxlength="40"
                placeholder="Your name (optional)"
                autocomplete="given-name"
                value="${escapeHtml(state.playerName || DEFAULT_PLAYER_NAME)}"
                data-testid="name-input"
              />
              <p class="form-error" data-testid="start-error" hidden></p>
              <button type="submit" class="btn primary cover-begin" data-testid="start-btn">
                Begin the story
              </button>
            </form>
            ${resumeHtml}
          </div>
        </div>
      </section>

      <footer class="site-footer quiet">
        <p>Romance Forge · woodcut romance, forged by choice</p>
        <p class="footer-contact">
          ${renderCsMailtoLink(entry.title, { className: 'cs-mailto footer-cs', testId: 'footer-cs-mailto', label: 'Contact us' })}
          <span class="footer-sep" aria-hidden="true">·</span>
          <a href="mailto:${CS_EMAIL}">${CS_EMAIL}</a>
        </p>
      </footer>

      <div class="sticky-begin" data-testid="sticky-begin" hidden>
        <button type="button" class="btn primary sticky-begin-btn" data-action="sticky-begin">
          Begin the story
        </button>
      </div>
      ${authModalHtml()}
    </main>
  `;
}

function renderReader() {
  const story = activeStory();
  const scene = getScene(story, state.sceneId);
  const spice = state.spice === 'hot' ? 'hot' : 'warm';
  const raw = getSceneText(scene, spice);
  const body = substituteName(raw, state.playerName);
  const ending = isEnding(scene);
  if (ending) maybeHydrateCloudReview(state.storyId || defaultStory.id);
  const choices = ending ? [] : getChoices(scene);
  // Reader: inline card after the choices (in flow) so it never covers prose or choices.
  const savePromptHtml = state.savePromptVisible
    ? `<aside class="save-prompt save-prompt--inline" data-testid="save-prompt" role="status">
         <p>Save your place — guest progress stays on this browser.</p>
         <div class="save-prompt-actions">
           <button type="button" class="btn secondary" data-action="open-auth-save" data-testid="save-across-devices">
             Save across devices
           </button>
           <button type="button" class="btn ghost" data-action="dismiss-save-prompt" data-testid="dismiss-save-prompt">
             Not now
           </button>
         </div>
       </aside>`
    : '';

  const replayHtml = state.previousSceneId
    ? `<button type="button" class="btn ghost" data-action="replay-last" data-testid="replay-last-btn">
         Replay last choice
       </button>`
    : '';

  const storyTitle = story.title || entryTitleFor(state.storyId);
  const guestDecision = getGuestReview(state.storyId || defaultStory.id);
  const showReview = shouldShowReviewPrompt({
    isEnding: ending,
    hasDecision: Boolean(guestDecision),
  });
  const reviewHtml = ending
    ? renderEndingReviewPanel({
        storyId: state.storyId || defaultStory.id,
        storyTitle,
        spice: spice,
        defaultDisplayName: defaultReviewDisplayName({
          isGuest: isGuest(state.auth),
          playerName: state.playerName,
        }),
        decision: showReview ? null : guestDecision,
      })
    : '';

  const whatIfOverrides = catalogEntry(state.storyId || defaultStory.id)?.whatIf;
  const whatIfCards = ending
    ? selectWhatIfCards(story, state.path, {
        spice,
        overrides: Array.isArray(whatIfOverrides) ? whatIfOverrides : undefined,
      })
    : [];
  const whatIfHtml = ending
    ? renderWhatIfMapHtml(whatIfCards, { escapeHtml })
    : "";

  const choicesHtml = ending
    ? `<div class="ending-block" data-testid="ending-block">
         <p class="ending-note" data-testid="ending-note">${escapeHtml(endingLineFor(state.storyId || defaultStory.id))}</p>
         ${reviewHtml}
         ${whatIfHtml}
         <button type="button" class="btn secondary" data-action="restart" data-testid="restart-btn">
           Restart
         </button>
         ${replayHtml}
       </div>`
    : `<p class="choice-prompt" data-testid="choice-prompt">What do you do?</p>
      <div class="choices" data-testid="choices" role="group" aria-label="Choices">
        ${choices
          .map(
            (c) => {
              const highlighted = state.whatIfHighlightId && state.whatIfHighlightId === c.id;
              const cls = highlighted ? "btn choice choice--what-if-highlight" : "btn choice";
              return `
          <button
            type="button"
            class="${cls}"
            data-action="choose"
            data-choice-id="${c.id}"
            data-testid="choice-${c.id}"
            ${highlighted ? "aria-description=\"Road not taken — suggested replay\"" : ""}
          >${escapeHtml(getChoiceText(c, spice))}</button>`;
            }
          )
          .join("")}
      </div>
      ${
        // Nothing to restart on the opening scene — keep it away from the first choice.
        state.sceneId === story.startSceneId
          ? ''
          : `<button type="button" class="btn ghost" data-action="restart" data-testid="restart-btn">
        Restart
      </button>`
      }`;

  const hasHotBody = Boolean(scene.textHot);
  const spiceSwapHtml = `
        <div class="spice-swap" data-testid="spice-swap" role="group" aria-label="Spice level">
          <button
            type="button"
            class="spice-swap-btn${spice === 'warm' ? ' is-active' : ''}"
            data-action="set-spice"
            data-spice="warm"
            data-testid="spice-swap-warm"
            aria-pressed="${spice === 'warm' ? 'true' : 'false'}"
          >Warm</button>
          <button
            type="button"
            class="spice-swap-btn${spice === 'hot' ? ' is-active' : ''}"
            data-action="set-spice"
            data-spice="hot"
            data-testid="spice-swap-hot"
            aria-pressed="${spice === 'hot' ? 'true' : 'false'}"
            ${hasHotBody ? '' : 'disabled aria-disabled="true" title="Hot prose unavailable for this scene"'}
          >Hot</button>
        </div>`;

  const artSrc = assetUrl(getSceneArtPath(state.storyId || defaultStory.id, scene));
  const artAlt = scene.title
    ? `Illustration: ${scene.title}`
    : 'Story illustration';
  const artHtml = `
        <figure class="scene-art" data-testid="scene-art" data-art-src="${escapeHtml(artSrc)}" hidden>
          <img
            class="scene-art-img"
            src="${escapeHtml(artSrc)}"
            alt="${escapeHtml(artAlt)}"
            width="1280"
            height="720"
            loading="eager"
            decoding="async"
            data-testid="scene-art-img"
          />
        </figure>`;

  return `
    <main class="page reader" data-testid="reader" data-spice="${spice}">
      <header class="reader-header">
        <div class="reader-brand">
          <img
            class="brand-logo tiny"
            src="${assetUrl('/brand/logo-heart-anvil.png')}"
            alt=""
            width="40"
            height="40"
            aria-hidden="true"
          />
          <div>
            <p class="brand-mark small">Romance Forge</p>
            <p class="story-title">${escapeHtml(story.title)}</p>
          </div>
        </div>
        ${scene.title ? `<h1 class="scene-title">${escapeHtml(scene.title)}</h1>` : ''}
        <div class="reader-meta">
          <p class="player-chip" data-testid="player-chip">
            Playing as ${escapeHtml(state.playerName)}
          </p>
          ${spiceSwapHtml}
          ${
            scene.layer
              ? `<p class="layer-progress" data-testid="layer-progress">Chapter ${scene.layer} of 10</p>`
              : ''
          }
          ${authHeaderHtml()}
        </div>
      </header>

      <article class="scene scene-enter" data-testid="scene" data-scene-id="${scene.id}">
        <div class="scene-body" data-testid="scene-body">
          ${artHtml}
          <div class="scene-text" data-testid="scene-text">${formatParagraphs(body)}</div>
        </div>
        ${choicesHtml}
      </article>
      ${savePromptHtml}
      ${authModalHtml()}
    </main>
  `;
}


/**
 * Reveal scene art when the image loads; on missing art, fall back to the
 * active story brand cover (do not hide the figure).
 */
function bindSceneArt() {
  const figure = app.querySelector('[data-testid="scene-art"]');
  const img = app.querySelector('[data-testid="scene-art-img"]');
  if (!figure || !img) return;

  const coverSrc = storyCoverPath(state.storyId || activeStory().id);

  const reveal = () => {
    figure.hidden = false;
    figure.removeAttribute('hidden');
    figure.classList.add('loaded');
    figure.removeAttribute('data-art-missing');
  };

  const useCoverFallback = () => {
    if (img.dataset.artFallback === '1') {
      // Cover itself failed — still reveal the figure (never blank-hide).
      reveal();
      return;
    }
    img.dataset.artFallback = '1';
    figure.setAttribute('data-art-fallback', 'cover');
    img.addEventListener('load', reveal, { once: true });
    img.addEventListener('error', useCoverFallback, { once: true });
    img.src = coverSrc;
  };

  const settle = () => {
    if (img.naturalWidth > 0) reveal();
    else useCoverFallback();
  };

  img.addEventListener('load', reveal, { once: true });
  img.addEventListener('error', useCoverFallback, { once: true });

  // Cached / already-decoded images: complete can be true before listeners attach.
  if (img.complete) {
    settle();
    return;
  }

  // decode() surfaces success even when load raced the listener attach.
  if (typeof img.decode === 'function') {
    img.decode().then(reveal).catch(() => {
      if (img.complete) settle();
    });
  }
}

function formatParagraphs(text) {
  return text
    .trim()
    .split(/\n\n+/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const MOMENTUM_MS = 240;
/** How long the armed "Tap again to restart" state lasts. */
const RESTART_CONFIRM_MS = 4000;

/** One-shot: after a what-if replay render, scroll/focus the highlighted choice. */
let _pendingWhatIfFocus = false;

function requestWhatIfHighlightFocus() {
  _pendingWhatIfFocus = true;
}

/**
 * After render, bring .choice--what-if-highlight into view (centered) and focus it.
 * Instant scroll only (no smooth) so prefers-reduced-motion is respected.
 * Falls back to scrollTo(0, 0) if the highlight is missing.
 */
function scheduleWhatIfHighlightFocus() {
  if (!_pendingWhatIfFocus) return;
  _pendingWhatIfFocus = false;
  const run = () => {
    const el = /** @type {HTMLElement | null} */ (
      app.querySelector('.choice--what-if-highlight')
    );
    if (!el) {
      window.scrollTo(0, 0);
      return;
    }
    try {
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
    } catch {
      window.scrollTo(0, 0);
      return;
    }
    try {
      el.focus({ preventScroll: true });
    } catch {
      /* jsdom / inert */
    }
  };
  // Double rAF: wait for layout after momentum → reader swap.
  requestAnimationFrame(() => {
    requestAnimationFrame(run);
  });
}


/**
 * Brief “…” beat, then next scene — keeps spice/story flow moving with no dead air.
 * @param {Partial<typeof state>} partial
 */
function advanceWithMomentum(partial) {
  state = { ...state, ...partial, _transitioning: true };
  app.innerHTML = `
    <main class="page reader momentum" data-testid="momentum" aria-live="polite">
      <p class="momentum-beat" data-testid="momentum-beat">…</p>
    </main>
  `;
  window.setTimeout(() => {
    state = { ...state, _transitioning: false };
    render();
  }, MOMENTUM_MS);
}

/** Last view/scene reported to analytics — fire page_view / scene_view on transitions only. */
let _trackedView = '';
let _trackedScene = '';

function trackViewTransition() {
  try {
    if (state.view === 'landing') {
      if (_trackedView !== 'landing') track('page_view', { meta: { view: 'landing' } });
      _trackedView = 'landing';
      _trackedScene = '';
      return;
    }
    _trackedView = 'reader';
    const key = `${state.storyId}|${state.sceneId}`;
    if (key === _trackedScene) return;
    _trackedScene = key;
    const scene = getScene(activeStory(), state.sceneId);
    const props = {
      storyId: state.storyId || defaultStory.id,
      spice: state.spice,
      layer: scene.layer,
      sceneId: state.sceneId,
    };
    track('scene_view', props);
    if (isEnding(scene)) {
      track('story_complete', props);
      try {
        saveLastFinished({
          storyId: state.storyId || defaultStory.id,
          path: Array.isArray(state.path) ? state.path : [],
          spice: state.spice === 'hot' ? 'hot' : 'warm',
        });
      } catch {
        /* sessionStorage must never affect rendering */
      }
    }
  } catch {
    /* analytics must never affect rendering */
  }
}

let _renderedView = '';
/** Until this time (ms), landing re-renders re-run revealSpiceMeter(). */
let _revealUntil = 0;

function render() {
  // Landing re-renders (story / spice pick) replace the whole DOM, which resets
  // the .cover-overlay scroll container and drops focus. Preserve both.
  // Reader spice swaps re-render in place — keep window scroll + focus on the toggle.
  const stayOnLanding = state.view === 'landing' && _renderedView === 'landing';
  const stayOnReader = state.view === 'reader' && _renderedView === 'reader';
  const overlay = app.querySelector('.cover-overlay');
  const overlayTop = overlay ? overlay.scrollTop : 0;
  const winY = window.scrollY;
  const focusId = document.activeElement?.getAttribute?.('data-testid');
  app.innerHTML = state.view === 'landing' ? renderLanding() : renderReader();
  if (stayOnLanding) {
    const nextOverlay = app.querySelector('.cover-overlay');
    if (nextOverlay) nextOverlay.scrollTop = overlayTop;
    if (window.scrollY !== winY) window.scrollTo(0, winY);
    if (focusId) {
      /** @type {HTMLElement | null} */ (
        app.querySelector(`[data-testid="${focusId}"]`)
      )?.focus({ preventScroll: true });
    }
    // Async re-renders (readers-say, review stars, auth) resize content above
    // the meter after a story pick; keep it revealed until the reader scrolls.
    if (Date.now() < _revealUntil) revealSpiceMeter();
  } else if (stayOnReader) {
    if (window.scrollY !== winY) window.scrollTo(0, winY);
    if (focusId) {
      /** @type {HTMLElement | null} */ (
        app.querySelector(`[data-testid="${focusId}"]`)
      )?.focus({ preventScroll: true });
    }
  } else if (state.view === 'reader' && _renderedView === 'landing') {
    window.scrollTo(0, 0);
  }
  _renderedView = state.view;
  bindEvents();
  trackViewTransition();
  scheduleWhatIfHighlightFocus();
}

function revealSpiceMeter() {
  const meter = app.querySelector('[data-testid="spice-meter"]');
  const begin = app.querySelector('[data-testid="start-btn"]') || meter;
  if (!meter || !begin) return;
  // Reserve the fixed sticky Begin bar (mobile only; display:none on desktop).
  const bar = /** @type {HTMLElement | null} */ (app.querySelector('.sticky-begin'));
  let stickyH = 0;
  if (bar) {
    const wasHidden = bar.hidden;
    bar.hidden = false;
    stickyH = bar.getBoundingClientRect().height;
    bar.hidden = wasHidden;
  }
  const viewBottom = window.innerHeight - stickyH;
  // Shift so [meter top, Begin bottom] fits in [top, bottom]; meter top wins.
  const delta = (top, bottom) => {
    const m = meter.getBoundingClientRect();
    const b = begin.getBoundingClientRect();
    if (m.top < top) return m.top - top;
    if (b.bottom > bottom) return Math.min(b.bottom - bottom, m.top - top);
    return 0;
  };
  const overlay = meter.closest('.cover-overlay');
  if (overlay) {
    const o = overlay.getBoundingClientRect();
    overlay.scrollTop += delta(Math.max(o.top, 0), Math.min(o.bottom, viewBottom));
  }
  const dy = delta(0, viewBottom);
  if (dy) window.scrollBy(0, dy);
}

function bindEvents() {
  app.querySelectorAll('[data-action="pick-story"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.hasAttribute('disabled')) return;
      const id = btn.getAttribute('data-story-id');
      if (!id) return;
      track('story_click', { storyId: id, meta: { via: 'card' } });
      setState({ storyId: id });
      _revealUntil = Date.now() + 4000;
      revealSpiceMeter();
      refreshReadersSay(id);
    });
  });

  app.querySelectorAll('input[name="spice"]').forEach((input) => {
    input.addEventListener('change', () => {
      const val = /** @type {HTMLInputElement} */ (input).value;
      if (val === 'warm' || val === 'hot') {
        setState({ spice: val });
      }
    });
  });

  app.querySelectorAll('[data-action="set-spice"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.hasAttribute('disabled') || state._transitioning) return;
      const val = btn.getAttribute('data-spice');
      if (val !== 'warm' && val !== 'hot') return;
      if (val === state.spice) return;
      // Same-night spice flip: update shared spice state only — no path/scene
      // advance, so ads cadence and scene analytics stay untouched.
      setState({ spice: val });
    });
  });

  const stickyBar = app.querySelector('[data-testid="sticky-begin"]');
  const stickyBegin = app.querySelector('[data-action="sticky-begin"]');
  if (stickyBegin && stickyBar) {
    stickyBegin.addEventListener('click', () => {
      const form = document.getElementById('start-form');
      const input = /** @type {HTMLInputElement | null} */ (
        document.getElementById('player-name')
      );
      const spiceRadio = /** @type {HTMLInputElement | null} */ (
        app.querySelector('input[name="spice"]:checked')
      );
      const spice = spiceRadio?.value || state.spice;
      const storyOk =
        state.storyId &&
        CATALOG.some((c) => c.id === state.storyId && c.available);
      const ready = storyOk && (spice === 'warm' || spice === 'hot');

      // Always run the form's submit handler: when something is missing it
      // shows the inline error (e.g. "Choose Warm or Hot") instead of a silent scroll.
      if (form) {
        if (typeof form.requestSubmit === 'function') form.requestSubmit();
        else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
      if (ready) return;

      const meter = app.querySelector('[data-testid="spice-meter"]');
      const needsSpice = storyOk && spice !== 'warm' && spice !== 'hot';
      ((needsSpice && meter) || form)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (!needsSpice && !storyOk) input?.focus({ preventScroll: true });
    });

    // Show sticky Begin only once the on-cover CTA scrolls away — avoid fighting it.
    const coverCta = app.querySelector('[data-testid="start-btn"]');
    if (coverCta && typeof IntersectionObserver === 'function') {
      const io = new IntersectionObserver(
        ([entry]) => {
          const show = !entry.isIntersecting;
          stickyBar.hidden = !show;
          stickyBar.toggleAttribute('hidden', !show);
        },
        { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
      );
      io.observe(coverCta);
    } else {
      stickyBar.hidden = true;
    }
  }

  // Landing re-renders (story / spice pick, async review + auth refreshes) replace
  // the whole form. Keep the typed name in state so it survives them.
  const nameField = /** @type {HTMLInputElement | null} */ (
    app.querySelector('[data-testid="name-input"]')
  );
  if (nameField) {
    nameField.addEventListener('input', () => {
      state = { ...state, playerName: nameField.value };
    });
  }

  const form = document.getElementById('start-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const err = app.querySelector('[data-testid="start-error"]');
      const input = /** @type {HTMLInputElement} */ (
        document.getElementById('player-name')
      );
      const name = resolvePlayerName(input?.value);
      const spiceRadio = /** @type {HTMLInputElement | null} */ (
        app.querySelector('input[name="spice"]:checked')
      );
      const spice = spiceRadio?.value || state.spice;
      const storyOk =
        state.storyId &&
        CATALOG.some((c) => c.id === state.storyId && c.available);
      if (state.storyId) track('story_click', { storyId: state.storyId, meta: { via: 'start' } });

      if (!storyOk) {
        if (err) {
          err.hidden = false;
          err.textContent = 'Pick a story to continue.';
        }
        return;
      }
      if (spice !== 'warm' && spice !== 'hot') {
        if (err) {
          err.hidden = false;
          err.textContent = 'Choose Warm or Hot before you start.';
        }
        return;
      }
      if (err) {
        err.hidden = true;
        err.textContent = '';
      }
      const whatIfPending = state._pendingWhatIfReplay;
      const pending = state._pendingResume ? loadGuestSave(state.storyId || defaultStory.id) : null;
      const current = activeStory();
      const usingWhatIf =
        Boolean(whatIfPending?.sceneId && whatIfPending.path?.length);
      const startId = usingWhatIf
        ? whatIfPending.sceneId
        : pending?.sceneId && pending.path?.length
          ? pending.sceneId
          : current.startSceneId;
      const startPath = usingWhatIf
        ? [...whatIfPending.path]
        : pending?.path?.length
          ? [...pending.path]
          : [current.startSceneId];
      const highlightId = usingWhatIf ? whatIfPending.highlightId || '' : '';
      const storyIdForAds = state.storyId || defaultStory.id;
      // Fresh start (not resume / not what-if replay): reset mid/end ad budget.
      if (!usingWhatIf && !(pending?.sceneId && pending.path?.length)) {
        resetStoryAdsShown(storyIdForAds);
      }
      track('story_start', {
        storyId: storyIdForAds,
        spice,
        playerName: chosenNameForAnalytics(name),
        meta: {
          resume: Boolean(pending?.sceneId && pending.path?.length),
          whatIfReplay: usingWhatIf,
        },
      });
      if (usingWhatIf) requestWhatIfHighlightFocus();
      setState({
        view: 'reader',
        playerName: name,
        spice,
        sceneId: startId,
        previousSceneId: '',
        path: startPath,
        whatIfHighlightId: highlightId,
        _pendingResume: false,
        _pendingWhatIfReplay: null,
        savePromptVisible: false,
      });
    });
  }

  app.querySelectorAll('[data-action="choose"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const choiceId = btn.getAttribute('data-choice-id');
      if (!choiceId || state._transitioning) return;
      const storyNow = activeStory();
      const scene = getScene(storyNow, state.sceneId);
      const nextId = resolveChoice(scene, choiceId);
      const fromId = state.sceneId;
      const nextPath = appendPath(state.path.length ? state.path : [fromId], nextId);
      maybeOfferSavePrompt('choice');
      persistGuestProgress({ sceneId: nextId, path: nextPath });

      const nextScene = getScene(storyNow, nextId);
      track('choice', {
        storyId: state.storyId || defaultStory.id,
        spice: state.spice,
        layer: scene.layer,
        sceneId: fromId,
        meta: { choice: choiceId, to: nextId },
      });
      const adsCfg = getAdsConfig();
      const storyIdForAds = state.storyId || defaultStory.id;
      const adsShownThisStory = getStoryAdsShown(storyIdForAds);
      const gate = {
        adsEnabled: adsCfg.enabled,
        fromSceneId: fromId,
        toSceneId: nextId,
        pathLength: nextPath.length,
        isEnding: isEndingDestination(nextScene, nextId),
        isAuthFlow: Boolean(state.authModalOpen),
        isStartScene: nextId === storyNow.startSceneId,
        isReplay: false,
        reason: 'between-scene',
        adsShownThisStory,
      };

      const advance = () => {
        bumpAdsStat('sceneAdvance');
        advanceWithMomentum({
          sceneId: nextId,
          previousSceneId: fromId,
          path: nextPath,
          whatIfHighlightId: '',
        });
      };

      if (shouldShowInterstitial(gate)) {
        state = { ...state, _transitioning: true };
        bumpStoryAdsShown(storyIdForAds);
        track('ad_shown', { storyId: storyIdForAds, meta: { reason: 'between-scene' } });
        showInterstitial({ config: adsCfg, reason: 'between-scene' })
          .then(() => {
            state = { ...state, _transitioning: false };
            advance();
          })
          .catch(() => {
            state = { ...state, _transitioning: false };
            advance();
          });
        return;
      }

      advance();
    });
  });

  app.querySelectorAll('[data-action="replay-last"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!state.previousSceneId || state._transitioning) return;
      const replayId = state.previousSceneId;
      const trimmed = trimPathToScene(state.path, replayId);
      persistGuestProgress({ sceneId: replayId, path: trimmed });
      // Replay-last skips interstitial ads (no shouldShowInterstitial call).
      advanceWithMomentum({
        sceneId: replayId,
        previousSceneId: '',
        path: trimmed,
        whatIfHighlightId: '',
      });
    });
  });

  // What-if Replay from here: jump to fork, keep name/spice, highlight alternate.
  // Intentionally skips interstitial ads (same as replay-last) so cards are not covered.
  app.querySelectorAll('[data-action="what-if-replay"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state._transitioning) return;
      const forkId = btn.getAttribute('data-fork-scene-id');
      const highlightId = btn.getAttribute('data-highlight-choice-id') || '';
      if (!forkId) return;
      const trimmed = pathForReplayFrom(state.path, forkId);
      persistGuestProgress({ sceneId: forkId, path: trimmed });
      requestWhatIfHighlightFocus();
      advanceWithMomentum({
        sceneId: forkId,
        previousSceneId: '',
        path: trimmed,
        whatIfHighlightId: highlightId,
      });
    });
  });

  app.querySelectorAll('[data-action="dismiss-what-if-compact"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      clearLastFinished();
      render();
    });
  });

  // Landing compact Replay from here — reuse name/spice flow; skip interstitial ads.
  app.querySelectorAll('[data-action="what-if-replay-landing"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state._transitioning) return;
      const finished = loadLastFinished();
      if (!finished?.storyId || !finished.path?.length) return;
      const forkId = btn.getAttribute('data-fork-scene-id');
      const highlightId = btn.getAttribute('data-highlight-choice-id') || '';
      if (!forkId) return;
      const trimmed = pathForReplayFrom(finished.path, forkId);
      const spice =
        finished.spice === 'hot' || finished.spice === 'warm'
          ? finished.spice
          : state.spice === 'hot' ? 'hot' : 'warm';
      const nameInput = /** @type {HTMLInputElement | null} */ (
        app.querySelector('[data-testid="name-input"]')
      );
      const typedName = resolvePlayerName(nameInput?.value || state.playerName);
      const err = app.querySelector('[data-testid="start-error"]');

      // Persist fork under selected story for save integrity.
      state = { ...state, storyId: finished.storyId, spice };
      persistGuestProgress({ sceneId: forkId, path: trimmed });


      track('story_start', {
        storyId: finished.storyId,
        spice,
        playerName: chosenNameForAnalytics(typedName),
        meta: { whatIfReplay: true, from: 'landing-compact' },
      });
      requestWhatIfHighlightFocus();
      setState({
        view: 'reader',
        playerName: typedName,
        spice,
        storyId: finished.storyId,
        sceneId: forkId,
        previousSceneId: '',
        path: trimmed,
        whatIfHighlightId: highlightId,
        _pendingResume: false,
        _pendingWhatIfReplay: null,
        savePromptVisible: false,
      });
    });
  });

  app.querySelectorAll('[data-action="restart"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      // Two-tap confirm (no window.confirm: blocked in some in-app browsers).
      if (btn.getAttribute('data-armed') !== '1') {
        btn.setAttribute('data-armed', '1');
        btn.classList.add('is-armed');
        btn.textContent = 'Tap again to restart';
        btn.setAttribute('aria-live', 'polite');
        window.setTimeout(() => {
          if (!btn.isConnected) return;
          btn.removeAttribute('data-armed');
          btn.classList.remove('is-armed');
          btn.textContent = 'Restart';
        }, RESTART_CONFIRM_MS);
        return;
      }
      maybeOfferSavePrompt('exit');
      persistGuestProgress();
      const showPrompt = state.savePromptVisible;
      const goLanding = () => {
        setState({
          view: 'landing',
          playerName: '',
          sceneId: activeStory().startSceneId,
          previousSceneId: '',
          path: [],
          whatIfHighlightId: '',
          savePromptVisible: showPrompt,
          // keep spice + storyId so restart is frictionless
        });
      };

      // End-slot interstitial: soft post-play before return to landing.
      const adsCfg = getAdsConfig();
      const storyIdForAds = state.storyId || defaultStory.id;
      const postGate = {
        adsEnabled: adsCfg.enabled,
        reason: 'post-play',
        adsShownThisStory: getStoryAdsShown(storyIdForAds),
        isAuthFlow: Boolean(state.authModalOpen),
        isReplay: false,
      };
      if (shouldShowInterstitial(postGate)) {
        state = { ...state, _transitioning: true };
        bumpStoryAdsShown(storyIdForAds);
        track('ad_shown', { storyId: storyIdForAds, meta: { reason: 'post-play' } });
        showInterstitial({ config: adsCfg, reason: 'post-play' })
          .then(() => {
            state = { ...state, _transitioning: false };
            goLanding();
          })
          .catch(() => {
            state = { ...state, _transitioning: false };
            goLanding();
          });
        return;
      }

      goLanding();
    });
  });

  app.querySelectorAll('[data-action="dismiss-save-prompt"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      markSavePromptDismissed();
      setState({ savePromptVisible: false });
    });
  });

  app.querySelectorAll('[data-action="review-star"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const n = Number(btn.getAttribute('data-stars'));
      if (!Number.isInteger(n) || n < 1 || n > 5) return;
      state = { ...state, reviewDraftStars: n };
      const hidden = /** @type {HTMLInputElement | null} */ (
        app.querySelector('[data-testid="review-stars-value"]')
      );
      if (hidden) hidden.value = String(n);
      app.querySelectorAll('[data-action="review-star"]').forEach((el) => {
        const sn = Number(el.getAttribute('data-stars'));
        el.classList.toggle('selected', sn <= n);
        el.setAttribute('aria-pressed', sn === n ? 'true' : 'false');
      });
      const err = app.querySelector('[data-testid="review-error"]');
      if (err) {
        err.hidden = true;
        err.textContent = '';
      }
    });
  });

  app.querySelectorAll('[data-action="review-skip"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const storyId = state.storyId || defaultStory.id;
      dismissGuestReview(storyId);
      setState({ reviewDraftStars: 0 });
    });
  });

  app.querySelectorAll('[data-action="review-submit"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      submitEndingReview();
    });
  });

  app.querySelectorAll('[data-action="start-fresh"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const storyId = state.storyId || defaultStory.id;
      clearGuestSave(storyId);
      resetStoryAdsShown(storyId);
      setState({ _pendingResume: false });
    });
  });

  app.querySelectorAll('[data-action="resume"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const saved = loadGuestSave(state.storyId || defaultStory.id);
      if (!saved?.sceneId) return;
      const form = document.getElementById('start-form');
      const input = /** @type {HTMLInputElement | null} */ (
        document.getElementById('player-name')
      );
      const spiceRadio = /** @type {HTMLInputElement | null} */ (
        app.querySelector('input[name="spice"]:checked')
      );
      const spice = spiceRadio?.value || state.spice;
      const name = resolvePlayerName(input?.value);
      const storyOk =
        state.storyId &&
        CATALOG.some((c) => c.id === state.storyId && c.available);

      if (storyOk && (spice === 'warm' || spice === 'hot')) {
        track('story_start', {
          storyId: state.storyId,
          spice,
          playerName: chosenNameForAnalytics(name),
          meta: { resume: true },
        });
        setState({
          view: 'reader',
          playerName: name,
          spice,
          sceneId: saved.sceneId,
          previousSceneId: '',
          path: [...saved.path],
          _pendingResume: false,
          savePromptVisible: false,
        });
        return;
      }

      // Soft handoff: mark resume, keep Begin the story as the primary CTA.
      state = { ...state, _pendingResume: true };
      form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input?.focus({ preventScroll: true });
      const err = app.querySelector('[data-testid="start-error"]');
      if (err) {
        err.hidden = false;
        err.textContent = 'Choose Warm or Hot, then Begin to continue.';
      }
    });
  });

  app.querySelectorAll('[data-action="open-auth"], [data-action="open-auth-save"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const fromSave = btn.getAttribute('data-action') === 'open-auth-save';
      openAuthModal(fromSave ? 'signup' : 'signin');
    });
  });

  app.querySelectorAll('[data-action="close-auth"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      closeAuthModal();
    });
  });

  app.querySelectorAll('[data-action="auth-backdrop"]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target === el) closeAuthModal();
    });
  });

  app.querySelectorAll('[data-action="auth-tab"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab') === 'signup' ? 'signup' : 'signin';
      setState({ authModalTab: tab, authStatusMessage: '' });
    });
  });

  const authForm = app.querySelector('[data-testid="auth-form"]');
  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (isAuthMockEnabled()) {
        runMockAccountHandoff();
        return;
      }
      if (!cloudConfigured) {
        setState({
          authModalOpen: true,
          authStatusMessage: CLOUD_AUTH_NOT_CONFIGURED,
        });
        return;
      }
      const fd = new FormData(authForm);
      const email = String(fd.get('email') || '').trim();
      const password = String(fd.get('password') || '');
      if (!email || !password) {
        setState({
          authModalOpen: true,
          authStatusMessage: 'Enter email and password.',
        });
        return;
      }
      const isSignup = state.authModalTab === 'signup';
      setState({ authStatusMessage: isSignup ? 'Creating account…' : 'Signing in…' });
      (async () => {
        const result = isSignup
          ? await signUpWithPassword(email, password)
          : await signInWithPassword(email, password);
        if (result.error) {
          setState({ authModalOpen: true, authStatusMessage: result.error });
          return;
        }
        if (isSignup) track('signup', { meta: { needsConfirm: Boolean(result.needsConfirm) } });
        if (result.needsConfirm) {
          setState({
            authModalOpen: true,
            authStatusMessage:
              'Check your email to confirm, then sign in. Guest progress stays on this browser.',
          });
          return;
        }
        if (isGuest(result.session)) {
          setState({
            authModalOpen: true,
            authStatusMessage: 'Signed up — please sign in.',
          });
          return;
        }
        await applyAuthenticatedSession(result.session);
      })().catch((err) => {
        setState({
          authModalOpen: true,
          authStatusMessage: err?.message || 'Sign-in didn’t work. Please try again.',
        });
      });
    });
  }

  app.querySelectorAll('[data-action="auth-mock-handoff"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!isMockAuthAllowed()) return; // dev-only; button is not rendered in production
      setAuthMockEnabled(true);
      runMockAccountHandoff();
    });
  });

  app.querySelectorAll('[data-action="sign-out"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      (async () => {
        if (cloudConfigured) {
          try {
            await signOutCloud();
          } catch {
            /* ignore */
          }
        }
        const guest = createGuestSession();
        persistAuthSession(guest);
        setState({ auth: guest, authStatusMessage: '', cloudResume: null });
      })();
    });
  });

  bindSceneArt();
}

// Boot
['wheel', 'pointerdown', 'keydown'].forEach((type) =>
  window.addEventListener(type, () => { _revealUntil = 0; }, { passive: true })
);
bindOutboundTracking();
render();

if (cloudConfigured) {
  fetchAuthSession().then(async (session) => {
    if (!isGuest(session)) {
      persistAuthSession(session);
      setState({ auth: session });
      await refreshCloudResume(state.storyId || defaultStory.id);
    } else if (!isGuest(state.auth) && state.auth.userId === MOCK_USER_ID) {
      /* keep local mock session */
    } else if (!isGuest(state.auth)) {
      // Stale persisted non-mock session without live supabase session → guest
      const guest = createGuestSession();
      persistAuthSession(guest);
      setState({ auth: guest, cloudResume: null });
    }
  });
  onAuthSessionChange(async (session) => {
    if (isGuest(session)) {
      if (!isAuthMockEnabled()) {
        persistAuthSession(session);
        setState({ auth: session, cloudResume: null });
      }
      return;
    }
    if (state.auth?.userId === session.userId) {
      await refreshCloudResume(state.storyId || defaultStory.id);
      return;
    }
    await applyAuthenticatedSession(session);
  });
}

// Phase 4: load public review aggregates (fail soft if schema missing).
refreshReviewAggregates();
refreshReadersSay(state.storyId || defaultStory.id);

// Prefetch AdSense on boot when enabled (site verification + first interstitial).
const bootAds = getAdsConfig();
if (bootAds.enabled && bootAds.clientId) {
  ensureAdSenseScript(bootAds.clientId);
}

window.addEventListener('pagehide', handleGuestPageHide);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') handleGuestPageHide();
});

// Expose for tests
export {
  state,
  setState,
  render,
  requestWhatIfHighlightFocus,
  scheduleWhatIfHighlightFocus,
  defaultStory as story,
  getStory,
  STORIES,
  CATALOG,
  DEFAULT_ENDING_LINE,
  endingLineFor,
  activeStory,
  localSaveStore,
  cloudSaveStore,
  cloudReviewStore,
  cloudConfigured,
  refreshReviewAggregates,
  submitEndingReview,
  persistGuestProgress,
  loadGuestSave,
  clearGuestSave,
  handleGuestPageHide,
  openAuthModal,
  closeAuthModal,
  runMockAccountHandoff,
  refreshCloudResume,
  applyAuthenticatedSession,
};
export { resumeSceneLabel, humanizeSceneId } from './save/resumeLabel.js';
export { getAdsConfig, areAdsEnabled } from './ads/config.js';
export { shouldShowInterstitial, isEndingDestination } from './ads/shouldShow.js';
export { getAdsStats } from './ads/stats.js';
export {
  shouldShowReviewPrompt,
  csMailtoHref,
  formatCatalogStars,
  CS_EMAIL,
} from './reviews/ui.js';
export {
  getGuestReview,
  setGuestReview,
  dismissGuestReview,
  hasGuestReviewDecision,
  REVIEW_BODY_MAX,
} from './reviews/localStore.js';
export { aggregateFromStars, createReviewRecord } from './reviews/supabaseStore.js';
