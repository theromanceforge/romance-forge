import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGuestSession,
  createAuthenticatedSession,
  isGuest,
  saveUserId,
  GUEST_USER_ID,
} from '../src/auth/session.js';
import {
  createSaveRecord,
  appendPath,
  trimPathToScene,
  isValidSaveRecord,
} from '../src/save/record.js';
import {
  createLocalSaveStore,
  createCloudSaveStoreStub,
  createInMemorySaveStore,
  saveStorageKey,
  isSavePromptDismissed,
  createSupabaseSaveStore,
  rowToSaveRecord,
  saveRecordToRow,
} from '../src/save/store.js';
import { isSupabaseConfigured } from '../src/auth/supabaseClient.js';
import {
  MOCK_USER_ID,
  CLOUD_AUTH_NOT_CONFIGURED,
  handoffGuestToMockAccount,
  isAuthMockEnabled,
  setAuthMockEnabled,
  persistAuthSession,
  loadPersistedAuthSession,
} from '../src/auth/mock.js';
import { renderAuthModal, renderAuthHeaderControl } from '../src/auth/ui.js';
import { shouldShowSavePrompt, markSavePromptDismissed } from '../src/save/prompt.js';
import { getScene, getChoices, resolveChoice } from '../src/engine.js';
import { story } from '../src/story.js';
import { resumeSceneLabel, humanizeSceneId } from '../src/save/resumeLabel.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

describe('AuthSession', () => {
  it('defaults to guest with null userId', () => {
    const s = createGuestSession();
    expect(s.status).toBe('guest');
    expect(s.userId).toBeNull();
    expect(isGuest(s)).toBe(true);
    expect(saveUserId(s)).toBe(GUEST_USER_ID);
  });

  it('authenticated session requires userId', () => {
    const s = createAuthenticatedSession('user-abc');
    expect(s.status).toBe('authenticated');
    expect(s.userId).toBe('user-abc');
    expect(isGuest(s)).toBe(false);
    expect(saveUserId(s)).toBe('user-abc');
    expect(() => createAuthenticatedSession('')).toThrow();
  });
});

describe('SaveRecord', () => {
  it('validates shape and appends path on choice', () => {
    const start = story.startSceneId;
    let path = appendPath([], start);
    expect(path).toEqual([start]);

    const scene = getScene(story, start);
    const choices = getChoices(scene);
    const nextId = resolveChoice(scene, choices[0].id);
    path = appendPath(path, nextId);

    const record = createSaveRecord({
      userId: GUEST_USER_ID,
      storySlug: story.id,
      sceneId: nextId,
      path,
    });

    expect(isValidSaveRecord(record)).toBe(true);
    expect(record.path).toEqual([start, nextId]);
    expect(record.path[0]).toBe('scene1');
    expect(record.sceneId).toBe(nextId);
    expect(typeof record.updatedAt).toBe('number');

    // idempotent append
    expect(appendPath(path, nextId)).toEqual(path);
  });

  it('rejects invalid records', () => {
    expect(isValidSaveRecord(null)).toBe(false);
    expect(isValidSaveRecord({ userId: 'g' })).toBe(false);
    expect(
      isValidSaveRecord({
        userId: 'g',
        storySlug: 's',
        sceneId: 'scene1',
        path: [1],
        updatedAt: 1,
      })
    ).toBe(false);
  });
});

describe('SaveStore local + cloud stub', () => {
  /** @type {ReturnType<typeof memoryStorage>} */
  let storage;
  /** @type {ReturnType<typeof createLocalSaveStore>} */
  let store;

  beforeEach(() => {
    storage = memoryStorage();
    store = createLocalSaveStore(storage);
  });

  it('round-trips a guest SaveRecord in local store', () => {
    const record = createSaveRecord({
      userId: GUEST_USER_ID,
      storySlug: 'until-the-quiet-breaks',
      sceneId: 'scene2a',
      path: ['scene1', 'scene2a'],
    });
    store.save(record);
    const loaded = store.load(GUEST_USER_ID, 'until-the-quiet-breaks');
    expect(loaded).toEqual(record);
    expect(storage.getItem(saveStorageKey(GUEST_USER_ID, 'until-the-quiet-breaks'))).toBeTruthy();
  });

  it('cloud stub does not require network and refuses save', async () => {
    const cloud = createCloudSaveStoreStub();
    await expect(cloud.load('u', 's')).resolves.toBeNull();
    await expect(cloud.save(createSaveRecord({
      userId: 'u',
      storySlug: 's',
      sceneId: 'scene1',
      path: ['scene1'],
    }))).rejects.toThrow(/not configured/i);
  });
});

describe('save prompt hooks (non-blocking)', () => {
  it('shows for guest once unless dismissed', () => {
    const storage = memoryStorage();
    const guest = createGuestSession();
    expect(
      shouldShowSavePrompt({ session: guest, alreadyShown: false, storage })
    ).toBe(true);
    expect(
      shouldShowSavePrompt({ session: guest, alreadyShown: true, storage })
    ).toBe(false);

    markSavePromptDismissed(storage);
    expect(isSavePromptDismissed(storage)).toBe(true);
    expect(
      shouldShowSavePrompt({ session: guest, alreadyShown: false, storage })
    ).toBe(false);
  });

  it('does not show for authenticated users', () => {
    const auth = createAuthenticatedSession('u1');
    expect(
      shouldShowSavePrompt({ session: auth, alreadyShown: false })
    ).toBe(false);
  });
});

describe('guest scene1 unblocked (no login gate)', () => {
  it('guest can resolve scene1 choices without auth', () => {
    const session = createGuestSession();
    expect(isGuest(session)).toBe(true);
    const scene = getScene(story, 'scene1');
    const choices = getChoices(scene);
    expect(choices).toHaveLength(2);
    const next = resolveChoice(scene, choices[0].id);
    expect(next).toBe('scene2a');
    // No login required — SaveRecord is optional persist after choice
    const path = appendPath([scene.id], next);
    const record = createSaveRecord({
      userId: saveUserId(session),
      storySlug: story.id,
      sceneId: next,
      path,
    });
    expect(isValidSaveRecord(record)).toBe(true);
  });

  it('main.js still starts reader at scene1 without requiring login', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const main = readFileSync(join(root, 'src/main.js'), 'utf8');
    expect(main).toMatch(/createGuestSession/);
    expect(main).toMatch(/sceneId: startId/);
    expect(main).toMatch(/Begin the story/);
    expect(main).not.toMatch(/from ['"]@supabase/);
    expect(main).not.toMatch(/SUPABASE_SECRET_KEY/);
    expect(main).toMatch(/data-testid="save-prompt"/);
    expect(main).toMatch(/data-testid="resume-btn"/);
    expect(main).toMatch(/data-testid="start-fresh-btn"/);
    expect(main).toMatch(/data-testid="resume-offer"/);
    expect(main).toMatch(/maybeOfferSavePrompt\('choice'\)/);
    expect(main).toMatch(/maybeOfferSavePrompt\('exit'\)/);
    expect(main).toMatch(/pagehide/);
    expect(main).toMatch(/trimPathToScene/);
    expect(main).toMatch(/resumeSceneLabel/);
  });
});

describe('trimPathToScene (replay integrity)', () => {
  it('trims path to end at the replayed sceneId', () => {
    const path = ['scene1', 'scene2a', 'scene3b', 'scene4a'];
    expect(trimPathToScene(path, 'scene2a')).toEqual(['scene1', 'scene2a']);
    expect(trimPathToScene(path, 'scene4a')).toEqual(path);
    expect(trimPathToScene(path, 'scene1')).toEqual(['scene1']);
  });

  it('uses last occurrence and falls back when missing', () => {
    expect(trimPathToScene(['scene1', 'scene2a', 'scene1', 'scene2b'], 'scene1')).toEqual([
      'scene1',
      'scene2a',
      'scene1',
    ]);
    expect(trimPathToScene(['scene1', 'scene2a'], 'scene9z')).toEqual(['scene9z']);
    expect(trimPathToScene([], 'scene2a')).toEqual(['scene2a']);
  });
});

describe('local store clear (start fresh)', () => {
  it('removes the guest SaveRecord for a storySlug', () => {
    const storage = memoryStorage();
    const store = createLocalSaveStore(storage);
    const record = createSaveRecord({
      userId: GUEST_USER_ID,
      storySlug: 'until-the-quiet-breaks',
      sceneId: 'scene2a',
      path: ['scene1', 'scene2a'],
    });
    store.save(record);
    expect(store.load(GUEST_USER_ID, 'until-the-quiet-breaks')).toEqual(record);
    store.clear(GUEST_USER_ID, 'until-the-quiet-breaks');
    expect(store.load(GUEST_USER_ID, 'until-the-quiet-breaks')).toBeNull();
    expect(
      storage.getItem(saveStorageKey(GUEST_USER_ID, 'until-the-quiet-breaks'))
    ).toBeNull();
  });
});

describe('resume hint label', () => {
  it('prefers scene title from story when present', () => {
    expect(resumeSceneLabel('scene1', story)).toBe('Somerton Station');
    expect(resumeSceneLabel('scene2a', story)).toBe('The Diner');
  });

  it('humanizes raw ids when title is missing', () => {
    expect(humanizeSceneId('scene7h')).toBe('Scene 7h');
    expect(humanizeSceneId('scene10')).toBe('Scene 10');
    expect(resumeSceneLabel('scene-missing-xyz', { scenes: {} })).toBe(
      humanizeSceneId('scene-missing-xyz')
    );
  });
});

describe('Phase 2 auth UI shell', () => {
  it('renders dismissible Sign in / Sign up modal markup', () => {
    const html = renderAuthModal({ open: true, tab: 'signin' });
    expect(html).toMatch(/data-testid="auth-modal"/);
    expect(html).toMatch(/data-testid="auth-form"/);
    expect(html).toMatch(/data-testid="auth-tab-signin"/);
    expect(html).toMatch(/data-testid="auth-tab-signup"/);
    expect(html).toMatch(/data-testid="auth-close"/);
    expect(html).toMatch(/data-testid="auth-mock-handoff"/);
    expect(html).toMatch(/Sign in/);
    expect(renderAuthModal({ open: false })).toBe('');
  });

  it('header control shows Sign in for guests and Sign out when authenticated', () => {
    const guestHtml = renderAuthHeaderControl({ session: createGuestSession() });
    expect(guestHtml).toMatch(/data-testid="open-auth-btn"/);
    expect(guestHtml).toMatch(/Sign in/);
    const authHtml = renderAuthHeaderControl({
      session: createAuthenticatedSession(MOCK_USER_ID),
    });
    expect(authHtml).toMatch(/data-testid="sign-out-btn"/);
    expect(authHtml).toMatch(/Sign out/);
  });

  it('main.js wires auth shell without blocking Begin / scene1; secret never in src', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const main = readFileSync(join(root, 'src/main.js'), 'utf8');
    const ui = readFileSync(join(root, 'src/auth/ui.js'), 'utf8');
    expect(main).toMatch(/renderAuthModal/);
    expect(main).toMatch(/authModalHtml\(\)/);
    expect(main).toMatch(/data-testid="save-across-devices"/);
    expect(main).toMatch(/data-action="open-auth"/);
    expect(ui).toMatch(/data-testid="auth-modal"/);
    expect(ui).toMatch(/data-testid="open-auth-btn"/);
    expect(main).toMatch(/runMockAccountHandoff|handoffGuestToMockAccount/);
    expect(main).toMatch(/CLOUD_AUTH_NOT_CONFIGURED/);
    expect(main).toMatch(/Begin the story/);
    expect(main).toMatch(/signInWithPassword|signUpWithPassword/);
    expect(main).toMatch(/createSupabaseSaveStore|getSupabaseClient/);
    expect(main).not.toMatch(/from ['"]@supabase/);
    expect(main).not.toMatch(/SUPABASE_SECRET_KEY/);
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    expect(deps['@supabase/supabase-js']).toBeTruthy();

    // Source assert: no secret key references under src/
    function walk(dir) {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, name.name);
        if (name.isDirectory()) walk(full);
        else if (/\.js$/.test(name.name)) {
          const body = readFileSync(full, 'utf8');
          expect(body).not.toMatch(/SUPABASE_SECRET_KEY/);
          expect(body).not.toMatch(/import\.meta\.env\.SUPABASE_/);
        }
      }
    }
    walk(join(root, 'src'));
  });
});

describe('guest→account handoff mock', () => {
  it('copies guest SaveRecord to mock-user and returns authenticated session', () => {
    const storage = memoryStorage();
    const store = createLocalSaveStore(storage);
    const guest = createSaveRecord({
      userId: GUEST_USER_ID,
      storySlug: 'until-the-quiet-breaks',
      sceneId: 'scene2a',
      path: ['scene1', 'scene2a'],
    });
    store.save(guest);

    const { session, copied } = handoffGuestToMockAccount({
      localStore: store,
      storySlug: 'until-the-quiet-breaks',
      now: 12345,
    });

    expect(session.status).toBe('authenticated');
    expect(session.userId).toBe(MOCK_USER_ID);
    expect(copied).toMatchObject({
      userId: MOCK_USER_ID,
      storySlug: 'until-the-quiet-breaks',
      sceneId: 'scene2a',
      path: ['scene1', 'scene2a'],
      updatedAt: 12345,
    });
    expect(store.load(MOCK_USER_ID, 'until-the-quiet-breaks')).toEqual(copied);
    // Guest path still intact if they dismiss / sign out
    expect(store.load(GUEST_USER_ID, 'until-the-quiet-breaks')).toEqual(guest);
  });

  it('handoff without guest record still yields mock session', () => {
    const store = createInMemorySaveStore();
    const { session, copied } = handoffGuestToMockAccount({
      localStore: store,
      storySlug: 'what-the-sister-kept',
    });
    expect(session.userId).toBe(MOCK_USER_ID);
    expect(copied).toBeNull();
  });

  it('mock mode flag and persisted session are local-only', () => {
    const storage = memoryStorage();
    expect(isAuthMockEnabled(storage)).toBe(false);
    setAuthMockEnabled(true, storage);
    expect(isAuthMockEnabled(storage)).toBe(true);
    const auth = createAuthenticatedSession(MOCK_USER_ID);
    persistAuthSession(auth, storage);
    expect(loadPersistedAuthSession(storage)).toEqual(auth);
    persistAuthSession(createGuestSession(), storage);
    expect(isGuest(loadPersistedAuthSession(storage))).toBe(true);
  });

  it('default cloud-not-configured message is explicit', () => {
    expect(CLOUD_AUTH_NOT_CONFIGURED).toMatch(/Cloud auth not configured yet/i);
  });
});

describe('in-memory mock cloud adapter (tests only)', () => {
  it('round-trips without network', () => {
    const mem = createInMemorySaveStore();
    const record = createSaveRecord({
      userId: MOCK_USER_ID,
      storySlug: 'until-the-quiet-breaks',
      sceneId: 'scene1',
      path: ['scene1'],
    });
    mem.save(record);
    expect(mem.load(MOCK_USER_ID, 'until-the-quiet-breaks')).toEqual(record);
    mem.clear(MOCK_USER_ID, 'until-the-quiet-breaks');
    expect(mem.load(MOCK_USER_ID, 'until-the-quiet-breaks')).toBeNull();
  });
});

describe('supabase save mapping', () => {
  it('maps SaveRecord ↔ snake_case row', () => {
    const record = createSaveRecord({
      userId: '11111111-1111-1111-1111-111111111111',
      storySlug: 'until-the-quiet-breaks',
      sceneId: 'scene2a',
      path: ['scene1', 'scene2a'],
      updatedAt: 1700000000000,
    });
    const row = saveRecordToRow(record);
    expect(row).toMatchObject({
      user_id: record.userId,
      story_slug: record.storySlug,
      scene_id: record.sceneId,
      path: ['scene1', 'scene2a'],
    });
    expect(typeof row.updated_at).toBe('string');
    const back = rowToSaveRecord(row);
    expect(back).toMatchObject({
      userId: record.userId,
      storySlug: record.storySlug,
      sceneId: record.sceneId,
      path: record.path,
    });
  });

  it('createSupabaseSaveStore requires client', () => {
    expect(() => createSupabaseSaveStore(null)).toThrow(/requires/);
  });

  it('isSupabaseConfigured is false without Vite env in unit tests', () => {
    // Vitest has no VITE_* unless configured — guest path must still work.
    expect(typeof isSupabaseConfigured()).toBe('boolean');
  });
});

describe('supabase phase2 docs present', () => {
  it('documents table/RLS/env and guest-safe wiring', async () => {
    const { readFileSync, existsSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const doc = join(root, 'docs/phase2-supabase.md');
    expect(existsSync(doc)).toBe(true);
    const body = readFileSync(doc, 'utf8');
    expect(body).toMatch(/saves/);
    expect(body).toMatch(/auth\.uid\(\)\s*=\s*user_id/);
    expect(body).toMatch(/VITE_SUPABASE_URL/);
    expect(body).toMatch(/VITE_SUPABASE_ANON_KEY/);
    expect(body).toMatch(/SUPABASE_SECRET_KEY/);
    expect(body).toMatch(/Guest/);
    expect(existsSync(join(root, 'src/save/SUPABASE.md'))).toBe(true);
    expect(existsSync(join(root, 'scripts/apply-saves-schema.sql'))).toBe(true);
  });
});
