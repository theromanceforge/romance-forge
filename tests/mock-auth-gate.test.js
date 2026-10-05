import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Mock auth (Demo button, mock hints, "Signed in (mock)", romanceForge.authMock)
 * is local-dev only: gated on import.meta.env.DEV.
 */

const MOCK_STRINGS = [/Demo: mock account/, /Mock mode on/, /Use Demo for a local/, /\(mock\)/, /auth-mock/];

function memoryStorage(seed = {}) {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

const STALE_MOCK = {
  'romanceForge.authMock': '1',
  'romanceForge.authSession': JSON.stringify({ userId: 'mock-user', status: 'authenticated' }),
};

async function load() {
  vi.resetModules();
  const mock = await import('../src/auth/mock.js');
  const ui = await import('../src/auth/ui.js');
  const session = await import('../src/auth/session.js');
  return { ...mock, ...ui, ...session };
}

function modalVariants(m) {
  const authed = m.createAuthenticatedSession('mock-user');
  const out = [];
  for (const cloudConfigured of [true, false]) {
    for (const mockEnabled of [true, false]) {
      out.push(m.renderAuthModal({ open: true, cloudConfigured, mockEnabled }));
      out.push(m.renderAuthModal({ open: true, cloudConfigured, mockEnabled, session: authed }));
    }
  }
  return out;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('production build (DEV=false)', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('PROD', true);
  });

  it('auth modal never shows the Demo button, mock hints or "(mock)"', async () => {
    const m = await load();
    expect(m.isMockAuthAllowed()).toBe(false);
    for (const html of modalVariants(m)) {
      for (const re of MOCK_STRINGS) expect(html).not.toMatch(re);
    }
    const signedIn = m.renderAuthModal({ open: true, cloudConfigured: false, session: m.createAuthenticatedSession('u1') });
    expect(signedIn).toMatch(/Signed in\./);
  });

  it('stale romanceForge.authMock=1 is treated as off', async () => {
    const m = await load();
    expect(m.isAuthMockEnabled(memoryStorage(STALE_MOCK))).toBe(false);
  });

  it('stale persisted mock-user session loads as guest; real sessions still load', async () => {
    const m = await load();
    expect(m.isGuest(m.loadPersistedAuthSession(memoryStorage(STALE_MOCK)))).toBe(true);
    const real = memoryStorage({
      'romanceForge.authSession': JSON.stringify({ userId: 'real-uuid', status: 'authenticated' }),
    });
    expect(m.loadPersistedAuthSession(real).userId).toBe('real-uuid');
  });

  it('app boot with stale mock storage stays guest and renders no mock UI', async () => {
    localStorage.clear();
    for (const [k, v] of Object.entries(STALE_MOCK)) localStorage.setItem(k, v);
    window.scrollTo = () => {};
    document.body.innerHTML = '<div id="app"></div>';
    vi.resetModules();
    const main = await import('../src/main.js');
    expect(main.state.auth.status).not.toBe('authenticated');
    main.openAuthModal('signin');
    const html = document.getElementById('app').innerHTML;
    expect(html).toMatch(/data-testid="auth-dialog"/);
    for (const re of MOCK_STRINGS) expect(html).not.toMatch(re);
    expect(document.querySelector('[data-testid="auth-chip"]')).toBeNull();
    localStorage.clear();
  });
});

describe('local dev (DEV=true)', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('PROD', false);
  });

  it('auth modal still shows the Demo button and hints', async () => {
    const m = await load();
    expect(m.isMockAuthAllowed()).toBe(true);
    const html = m.renderAuthModal({ open: true, cloudConfigured: false, mockEnabled: true });
    expect(html).toMatch(/data-testid="auth-mock-handoff"/);
    expect(html).toMatch(/Demo: mock account/);
    expect(html).toMatch(/Mock mode on/);
    expect(m.renderAuthModal({ open: true, cloudConfigured: true })).toMatch(/use Demo for a local-only handoff/);
    expect(m.renderAuthModal({ open: true, cloudConfigured: false })).toMatch(/Use Demo for a local handoff/);
    expect(
      m.renderAuthModal({ open: true, cloudConfigured: false, session: m.createAuthenticatedSession('mock-user') })
    ).toMatch(/Signed in \(mock\)\./);
  });

  it('authMock flag and persisted mock session still work', async () => {
    const m = await load();
    const s = memoryStorage(STALE_MOCK);
    expect(m.isAuthMockEnabled(s)).toBe(true);
    expect(m.loadPersistedAuthSession(s).userId).toBe('mock-user');
  });
});
