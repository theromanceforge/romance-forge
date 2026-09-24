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

const SPICE_KEY = 'romanceForge.spice';
const STORY_KEY = 'romanceForge.storyId';

const localSaveStore = createLocalSaveStore();
const supabaseClient = getSupabaseClient();
const cloudConfigured = Boolean(supabaseClient) && isSupabaseConfigured();
/** Live cloud when env present; stub otherwise (tests / no env). */
const cloudSaveStore = supabaseClient
  ? createSupabaseSaveStore(supabaseClient)
  : createCloudSaveStoreStub();

/** @returns {import('./engine.js').Story} */
function activeStory() {
  const id = state?.storyId;
  if (id && STORIES[id]) return STORIES[id];
  return defaultStory;
}

/** Brand cover path for a story slug. */
function storyCoverPath(storyId) {
  const id = storyId || defaultStory.id;
  return `/brand/cover-${id}.png`;
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

/** @type {{ id: string, title: string, blurb: string, available: boolean, accentSrc?: string, coverSrc: string, coverAlt: string, hook: string, pull: string, chips: string[], badge: string }} */
const CATALOG = [
  {
    id: 'until-the-quiet-breaks',
    title: 'Until the Quiet Breaks',
    blurb:
      'A finished playable romance: 10 endings, Warm & Hot. Fifteen years after leaving Somerton, Henry’s letter brings you home—Jake Shaw still keeps the diner with the blue door. Choose your path and let the quiet break.',
    available: true,
    accentSrc: '/brand/cover-until-the-quiet-breaks-square.png',
    coverSrc: '/brand/cover-until-the-quiet-breaks.png',
    coverAlt: 'Until the Quiet Breaks — rainy Somerton station woodcut',
    hook: 'Somerton rain. Jake Shaw still waiting. A quiet that wants to break— on your terms.',
    pull: 'The blue door still waits in the rain.',
    chips: ['Somerton rain', 'Jake Shaw', '10 endings'],
    badge: '10 endings · Warm & Hot',
  },
  {
    id: 'what-the-sister-kept',
    title: 'What the Sister Kept',
    blurb:
      'Harborwick mystery romance: cold case, missing sister, Detective Jake Akers. What she kept could reopen everything—or destroy what’s left of her family.',
    available: true,
    accentSrc: '/brand/cover-what-the-sister-kept-square.png',
    coverSrc: '/brand/cover-what-the-sister-kept.png',
    coverAlt: 'What the Sister Kept — Harborwick fog and cold-case romance',
    hook: 'Harborwick fog. Jake Akers at the door. A charm that might be Renny’s—and a secret she kept.',
    pull: 'Hope and dread share the doorway.',
    chips: ['Harborwick', 'Jake Akers', 'Cold case'],
    badge: 'Mystery · Warm & Hot',
  },
  {
    id: 'the-living-key',
    title: 'The Living Key',
    blurb:
      'A finished playable magical romance: 10 endings, Warm & Hot. Ashmere Collegium’s wards are singing wrong—Cassian Rook is assigned your handler, and a living key could remake the cliff or claim your throat.',
    available: true,
    accentSrc: '/brand/cover-the-living-key-square.png',
    coverSrc: '/brand/cover-the-living-key.png',
    coverAlt: 'The Living Key — Ashmere wards woodcut',
    hook: 'Ashmere Collegium. Cassian Rook. The wards are singing wrong.',
    pull: 'A living key. A dying ward-song. A choice that remakes the cliff.',
    chips: ['Ashmere', 'Cassian Rook', '10 endings'],
    badge: '10 endings · Warm & Hot / Magical romance',
  },
];

function catalogEntry(storyId) {
  return CATALOG.find((c) => c.id === storyId) || CATALOG.find((c) => c.available) || CATALOG[0];
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
  try {
    const v = sessionStorage.getItem(STORY_KEY);
    if (v && CATALOG.some((c) => c.id === v && c.available)) return v;
  } catch {
    /* ignore */
  }
  return CATALOG.find((c) => c.available)?.id || '';
}

/** @type {{ view: 'landing' | 'reader', playerName: string, sceneId: string, previousSceneId: string, spice: '' | 'warm' | 'hot', storyId: string, path: string[], auth: import('./auth/session.js').AuthSession, savePromptShown: boolean, savePromptVisible: boolean, savePromptTrigger: '' | 'choice' | 'exit', authModalOpen: boolean, authModalTab: 'signin' | 'signup', authStatusMessage: string, _pendingResume: boolean, _transitioning?: boolean }} */
let state = {
  view: 'landing',
  playerName: '',
  sceneId: defaultStory.startSceneId,
  previousSceneId: '',
  spice: readStoredSpice(),
  storyId: readStoredStoryId(),
  path: [],
  auth: loadPersistedAuthSession(),
  savePromptShown: false,
  savePromptVisible: false,
  savePromptTrigger: '',
  authModalOpen: false,
  authModalTab: 'signin',
  authStatusMessage: '',
  _pendingResume: false,
  /** @type {import('./save/record.js').SaveRecord | null} */
  cloudResume: null,
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
  const landingSavePromptHtml = state.savePromptVisible
    ? `<aside class="save-prompt" data-testid="save-prompt" role="status">
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
                  <span class="story-card-blurb">${escapeHtml(c.blurb)}</span>
                </span>
              </button>`;
            }).join('')}
          </div>
        </fieldset>`;

  const chipsHtml = (entry.chips || [])
    .map((chip) => `<li class="cover-chip">${escapeHtml(chip)}</li>`)
    .join('');

  const playableNow = CATALOG.filter((c) => c.available).map((c) => c.title);
  const comingSoon = CATALOG.filter((c) => !c.available).map((c) => c.title);
  const playableLine = playableNow.length
    ? `Live now: ${playableNow.join(' · ')}${comingSoon.length ? `. Coming soon: ${comingSoon.join(' · ')}` : ''}.`
    : 'Stories forging — check back soon.';

  const forgeStripHtml = `
      <section class="forge-strip" data-testid="forge-strip" aria-label="About Romance Forge">
        <div class="forge-strip-mark">
          <img
            class="forge-strip-logo"
            src="/brand/logo-heart-anvil.png"
            alt=""
            width="40"
            height="40"
            aria-hidden="true"
          />
          <p class="forge-strip-brand">Romance Forge — ink, ember, and the stories you choose.</p>
        </div>
        <p class="forge-strip-what">
          You are holding interactive branching spicy romance: you read by choosing, and the path burns different each time.
        </p>
        <p class="forge-strip-purpose">
          Forged for wine-night BookTok readers who want Warm yearning or Hot explicit heat — literary grit, not pink AI fluff.
        </p>
        <ol class="forge-strip-how">
          <li>Choose a title</li>
          <li>Pick Warm or Hot</li>
          <li>Branch through choices</li>
        </ol>
        <p class="forge-strip-playable" data-testid="playable-now">${escapeHtml(playableLine)}</p>
      </section>`;

  return `
    <main class="page landing cover-landing" data-testid="landing">
      <div class="landing-room" aria-hidden="true"></div>
      ${forgeStripHtml}
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
                src="/brand/logo-heart-anvil.png"
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
            <p class="cover-pull">${escapeHtml(entry.pull || '')}</p>
            <ul class="cover-chips" aria-label="Story atmosphere">
              ${chipsHtml}
            </ul>
            <span class="story-badge live cover-badge">${escapeHtml(entry.badge || '')}</span>

            <fieldset class="spice-meter cover-spice" data-testid="spice-meter">
              <legend class="visually-hidden">Spice level</legend>
              <p class="spice-hint">Warm = yearning soft-close. Hot = explicit body-POV—wine night, no apology.</p>
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

            <form id="start-form" class="start-form cover-start">
              <label for="player-name" class="visually-hidden">Your name</label>
              <input
                id="player-name"
                name="playerName"
                type="text"
                maxlength="40"
                placeholder="Your name (e.g. Eleanor)"
                autocomplete="given-name"
                required
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
        <p class="footer-contact"><a href="mailto:theromanceforge@gmail.com">theromanceforge@gmail.com</a></p>
      </footer>

      <div class="sticky-begin" data-testid="sticky-begin" hidden>
        <button type="button" class="btn primary sticky-begin-btn" data-action="sticky-begin">
          Begin the story
        </button>
      </div>
      ${landingSavePromptHtml}
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
  const choices = ending ? [] : getChoices(scene);
  const savePromptHtml = state.savePromptVisible
    ? `<aside class="save-prompt" data-testid="save-prompt" role="status">
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

  const choicesHtml = ending
    ? `<div class="ending-block" data-testid="ending-block">
         <p class="ending-note" data-testid="ending-note">The quiet isn't done with you.</p>
         <button type="button" class="btn secondary" data-action="restart" data-testid="restart-btn">
           Restart
         </button>
         ${replayHtml}
       </div>`
    : `<p class="choice-prompt" data-testid="choice-prompt">What do you do?</p>
      <div class="choices" data-testid="choices" role="group" aria-label="Choices">
        ${choices
          .map(
            (c) => `
          <button
            type="button"
            class="btn choice"
            data-action="choose"
            data-choice-id="${c.id}"
            data-testid="choice-${c.id}"
          >${escapeHtml(getChoiceText(c, spice))}</button>`
          )
          .join('')}
      </div>
      <button type="button" class="btn ghost" data-action="restart" data-testid="restart-btn">
        Restart
      </button>`;

  const spiceChip =
    spice === 'hot'
      ? '<span class="spice-chip hot" data-testid="spice-chip">Hot</span>'
      : '<span class="spice-chip warm" data-testid="spice-chip">Warm</span>';

  const artSrc = getSceneArtPath(state.storyId || defaultStory.id, scene);
  const artAlt = scene.title
    ? `Illustration: ${scene.title}`
    : `Illustration for ${scene.id}`;
  const artHtml = `
        <figure class="scene-art" data-testid="scene-art" data-art-src="${escapeHtml(artSrc)}" hidden>
          <img
            class="scene-art-img"
            src="${escapeHtml(artSrc)}"
            alt="${escapeHtml(artAlt)}"
            width="1024"
            height="1024"
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
            src="/brand/logo-heart-anvil.png"
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
            Playing as ${escapeHtml(state.playerName)} ${spiceChip}
          </p>
          ${
            scene.layer
              ? `<p class="layer-progress" data-testid="layer-progress">Layer ${scene.layer} of 10</p>`
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

function render() {
  app.innerHTML = state.view === 'landing' ? renderLanding() : renderReader();
  bindEvents();
}

function bindEvents() {
  app.querySelectorAll('[data-action="pick-story"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.hasAttribute('disabled')) return;
      const id = btn.getAttribute('data-story-id');
      if (!id) return;
      setState({ storyId: id });
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
      const name = (input?.value || '').trim();
      const storyOk =
        state.storyId &&
        CATALOG.some((c) => c.id === state.storyId && c.available);
      const ready =
        storyOk && (spice === 'warm' || spice === 'hot') && Boolean(name);

      if (ready && form) {
        if (typeof form.requestSubmit === 'function') form.requestSubmit();
        else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        return;
      }

      form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input?.focus({ preventScroll: true });
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

  const form = document.getElementById('start-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const err = app.querySelector('[data-testid="start-error"]');
      const input = /** @type {HTMLInputElement} */ (
        document.getElementById('player-name')
      );
      const name = (input?.value || '').trim();
      const spiceRadio = /** @type {HTMLInputElement | null} */ (
        app.querySelector('input[name="spice"]:checked')
      );
      const spice = spiceRadio?.value || state.spice;
      const storyOk =
        state.storyId &&
        CATALOG.some((c) => c.id === state.storyId && c.available);

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
      if (!name) {
        if (err) {
          err.hidden = false;
          err.textContent = 'Enter your name to begin.';
        }
        return;
      }
      if (err) {
        err.hidden = true;
        err.textContent = '';
      }
      const pending = state._pendingResume ? loadGuestSave(state.storyId || defaultStory.id) : null;
      const current = activeStory();
      const startId =
        pending?.sceneId && pending.path?.length
          ? pending.sceneId
          : current.startSceneId;
      const startPath =
        pending?.path?.length
          ? [...pending.path]
          : [current.startSceneId];
      setState({
        view: 'reader',
        playerName: name,
        spice,
        sceneId: startId,
        previousSceneId: '',
        path: startPath,
        _pendingResume: false,
        savePromptVisible: false,
      });
    });
  }

  app.querySelectorAll('[data-action="choose"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const choiceId = btn.getAttribute('data-choice-id');
      if (!choiceId || state._transitioning) return;
      const scene = getScene(activeStory(), state.sceneId);
      const nextId = resolveChoice(scene, choiceId);
      const fromId = state.sceneId;
      const nextPath = appendPath(state.path.length ? state.path : [fromId], nextId);
      maybeOfferSavePrompt('choice');
      persistGuestProgress({ sceneId: nextId, path: nextPath });
      advanceWithMomentum({
        sceneId: nextId,
        previousSceneId: fromId,
        path: nextPath,
      });
    });
  });

  app.querySelectorAll('[data-action="replay-last"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!state.previousSceneId || state._transitioning) return;
      const replayId = state.previousSceneId;
      const trimmed = trimPathToScene(state.path, replayId);
      persistGuestProgress({ sceneId: replayId, path: trimmed });
      advanceWithMomentum({
        sceneId: replayId,
        previousSceneId: '',
        path: trimmed,
      });
    });
  });

  app.querySelectorAll('[data-action="restart"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      maybeOfferSavePrompt('exit');
      persistGuestProgress();
      const showPrompt = state.savePromptVisible;
      setState({
        view: 'landing',
        playerName: '',
        sceneId: activeStory().startSceneId,
        previousSceneId: '',
        path: [],
        savePromptVisible: showPrompt,
        // keep spice + storyId so restart is frictionless
      });
    });
  });

  app.querySelectorAll('[data-action="dismiss-save-prompt"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      markSavePromptDismissed();
      setState({ savePromptVisible: false });
    });
  });

  app.querySelectorAll('[data-action="start-fresh"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      clearGuestSave(state.storyId || defaultStory.id);
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
      const name = (input?.value || '').trim();
      const storyOk =
        state.storyId &&
        CATALOG.some((c) => c.id === state.storyId && c.available);

      if (
        storyOk &&
        (spice === 'warm' || spice === 'hot') &&
        name
      ) {
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
        err.textContent = name
          ? 'Choose Warm or Hot, then Begin to continue.'
          : 'Enter your name, then Begin to continue where you left off.';
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
          authStatusMessage: err?.message || 'Auth failed.',
        });
      });
    });
  }

  app.querySelectorAll('[data-action="auth-mock-handoff"]').forEach((btn) => {
    btn.addEventListener('click', () => {
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

window.addEventListener('pagehide', handleGuestPageHide);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') handleGuestPageHide();
});

// Expose for tests
export {
  state,
  setState,
  render,
  defaultStory as story,
  getStory,
  STORIES,
  CATALOG,
  activeStory,
  localSaveStore,
  cloudSaveStore,
  cloudConfigured,
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
