/**
 * Auth UI shell — Sign in / Sign up modal (guest-safe, dismissible).
 * Live cloud when configured; mock demo remains as fallback.
 */

import { isGuest } from './session.js';
import { CLOUD_AUTH_NOT_CONFIGURED } from './mock.js';

/**
 * @param {{
 *   open: boolean,
 *   tab?: 'signin' | 'signup',
 *   session?: import('./session.js').AuthSession | null,
 *   statusMessage?: string,
 *   mockEnabled?: boolean,
 *   cloudConfigured?: boolean
 * }} opts
 * @returns {string} HTML fragment (empty when closed)
 */
export function renderAuthModal(opts) {
  const {
    open,
    tab = 'signin',
    session = null,
    statusMessage = '',
    mockEnabled = false,
    cloudConfigured = false,
  } = opts;

  if (!open) return '';

  const isSignup = tab === 'signup';
  const authenticated = session && !isGuest(session);
  const title = isSignup ? 'Sign up' : 'Sign in';
  const submitLabel = isSignup ? 'Create account' : 'Sign in';
  const status =
    statusMessage ||
    (authenticated
      ? `Signed in${cloudConfigured ? '' : ' (mock)'}.`
      : '');

  const lead = cloudConfigured
    ? 'Save progress across devices with your Romance Forge account. Guest play stays available — this never blocks Begin or scene&nbsp;1.'
    : 'Save progress across devices when cloud auth is wired. Guest play stays available — this never blocks Begin or scene&nbsp;1.';

  const mockHint = cloudConfigured
    ? mockEnabled
      ? 'Mock mode on — form submit uses local mock instead of cloud.'
      : 'Cloud auth ready — sign in with email, or use Demo for a local-only handoff.'
    : mockEnabled
      ? 'Mock mode on — form submit creates a local mock session.'
      : `Default submit shows “${CLOUD_AUTH_NOT_CONFIGURED.split('—')[0].trim()}”. Use Demo for a local handoff.`;

  return `
    <div class="auth-modal-backdrop" data-testid="auth-modal" data-action="auth-backdrop" role="presentation">
      <div
        class="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        data-testid="auth-dialog"
      >
        <header class="auth-modal-header">
          <h2 id="auth-modal-title" class="auth-modal-title">${title}</h2>
          <button
            type="button"
            class="btn ghost auth-close"
            data-action="close-auth"
            data-testid="auth-close"
            aria-label="Close"
          >×</button>
        </header>

        <p class="auth-modal-lead">
          ${lead}
        </p>

        <div class="auth-tabs" role="tablist" aria-label="Auth mode">
          <button
            type="button"
            class="auth-tab${!isSignup ? ' active' : ''}"
            role="tab"
            aria-selected="${!isSignup}"
            data-action="auth-tab"
            data-tab="signin"
            data-testid="auth-tab-signin"
          >Sign in</button>
          <button
            type="button"
            class="auth-tab${isSignup ? ' active' : ''}"
            role="tab"
            aria-selected="${isSignup}"
            data-action="auth-tab"
            data-tab="signup"
            data-testid="auth-tab-signup"
          >Sign up</button>
        </div>

        <form class="auth-form" data-testid="auth-form" data-auth-tab="${isSignup ? 'signup' : 'signin'}" novalidate>
          <label class="auth-label" for="auth-email">Email</label>
          <input
            id="auth-email"
            name="email"
            type="email"
            class="auth-input"
            autocomplete="${isSignup ? 'email' : 'username'}"
            placeholder="you@example.com"
            data-testid="auth-email"
          />
          <label class="auth-label" for="auth-password">Password</label>
          <input
            id="auth-password"
            name="password"
            type="password"
            class="auth-input"
            autocomplete="${isSignup ? 'new-password' : 'current-password'}"
            placeholder="••••••••"
            data-testid="auth-password"
          />
          <p class="auth-status" data-testid="auth-status" ${status ? '' : 'hidden'}>${escapeHtml(status)}</p>
          <div class="auth-form-actions">
            <button type="submit" class="btn primary" data-testid="auth-submit">
              ${submitLabel}
            </button>
            <button type="button" class="btn ghost" data-action="close-auth" data-testid="auth-dismiss">
              Not now
            </button>
          </div>
        </form>

        <div class="auth-mock-row">
          <button
            type="button"
            class="btn secondary"
            data-action="auth-mock-handoff"
            data-testid="auth-mock-handoff"
          >
            Demo: mock account
          </button>
          <p class="auth-mock-hint" data-testid="auth-mock-hint">
            ${mockHint}
          </p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Compact header control — Sign in or account chip.
 * @param {{ session?: import('./session.js').AuthSession | null }} opts
 * @returns {string}
 */
export function renderAuthHeaderControl(opts = {}) {
  const session = opts.session ?? null;
  if (session && !isGuest(session)) {
    return `
      <div class="auth-header-control" data-testid="auth-header">
        <span class="auth-chip" data-testid="auth-chip">Account</span>
        <button type="button" class="btn ghost auth-header-btn" data-action="sign-out" data-testid="sign-out-btn">
          Sign out
        </button>
      </div>`;
  }
  return `
    <div class="auth-header-control" data-testid="auth-header">
      <button type="button" class="btn ghost auth-header-btn" data-action="open-auth" data-testid="open-auth-btn">
        Sign in
      </button>
    </div>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export { CLOUD_AUTH_NOT_CONFIGURED };
