/**
 * Between-scene interstitial overlay — AdSense when configured, branded placeholder otherwise.
 * Fail-soft: never break play if script/ad blocked.
 */

import { getAdsConfig } from './config.js';
import { bumpAdsStat } from './stats.js';
import { assetUrl } from '../assetUrl.js';

const SCRIPT_ATTR = 'data-rf-adsense';
const ROOT_ID = 'rf-ads-interstitial';

let scriptInjected = false;

/**
 * Inject AdSense loader once when client id present.
 * @param {string} clientId
 */
export function ensureAdSenseScript(clientId) {
  if (!clientId || typeof document === 'undefined') return;
  if (scriptInjected) return;
  if (document.querySelector(`script[${SCRIPT_ATTR}]`)) {
    scriptInjected = true;
    return;
  }
  try {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    s.crossOrigin = 'anonymous';
    s.setAttribute(SCRIPT_ATTR, '1');
    s.onerror = () => {
      /* fail soft — placeholder path still works */
    };
    document.head.appendChild(s);
    scriptInjected = true;
  } catch {
    /* fail soft */
  }
}

/**
 * @param {HTMLElement} slotEl
 * @param {{ clientId: string, slot: string }} cfg
 */
function tryRenderAdSense(slotEl, cfg) {
  if (!cfg.clientId || !slotEl) return false;
  try {
    ensureAdSenseScript(cfg.clientId);
    slotEl.innerHTML = '';
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.style.minHeight = '90px';
    ins.setAttribute('data-ad-client', cfg.clientId);
    if (cfg.slot) ins.setAttribute('data-ad-slot', cfg.slot);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');
    slotEl.appendChild(ins);
    // @ts-ignore
    (window.adsbygoogle = window.adsbygoogle || []).push({});
    return true;
  } catch {
    return false;
  }
}

function placeholderHtml() {
  return `
    <div class="rf-ads-placeholder" data-testid="ads-placeholder">
      <img
        class="rf-ads-placeholder-logo"
        src="${assetUrl('/brand/logo-heart-anvil.png')}"
        alt=""
        width="48"
        height="48"
        aria-hidden="true"
      />
      <p class="rf-ads-placeholder-title">Romance Forge</p>
      <p class="rf-ads-placeholder-copy">A quiet beat between chapters — ads help keep free stories forging.</p>
    </div>
  `;
}

/**
 * Show interstitial; resolves when user continues or skips.
 * @param {{ reason?: string, config?: import('./config.js').AdsConfig }} [opts]
 * @returns {Promise<'continue' | 'skip'>}
 */
export function showInterstitial(opts = {}) {
  const cfg = opts.config || getAdsConfig();
  if (typeof document === 'undefined') {
    return Promise.resolve('continue');
  }

  // Remove any stale overlay
  const existing = document.getElementById(ROOT_ID);
  if (existing) existing.remove();

  bumpAdsStat('shown');

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.className = 'rf-ads-interstitial';
  root.setAttribute('data-testid', 'ads-interstitial');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'rf-ads-title');

  const useLive = Boolean(cfg.hasClient && cfg.clientId);
  root.innerHTML = `
    <div class="rf-ads-panel">
      <p id="rf-ads-title" class="rf-ads-kicker">A moment between scenes</p>
      <div class="rf-ads-slot" data-testid="ads-slot" data-ads-mode="${useLive ? 'adsense' : 'placeholder'}">
        ${useLive ? '' : placeholderHtml()}
      </div>
      <div class="rf-ads-actions">
        <button type="button" class="btn primary" data-ads-action="continue" data-testid="ads-continue">
          Continue story
        </button>
        <button type="button" class="btn ghost" data-ads-action="skip" data-testid="ads-skip">
          Skip
        </button>
      </div>
      <p class="rf-ads-hint" data-testid="ads-hint">Skip is always available.</p>
    </div>
  `;

  document.body.appendChild(root);

  if (useLive) {
    const slotEl = root.querySelector('[data-testid="ads-slot"]');
    const ok = tryRenderAdSense(/** @type {HTMLElement} */ (slotEl), cfg);
    if (!ok && slotEl) {
      slotEl.setAttribute('data-ads-mode', 'placeholder');
      slotEl.innerHTML = placeholderHtml();
    }
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (action) => {
      if (settled) return;
      settled = true;
      bumpAdsStat(action === 'skip' ? 'skip' : 'continue');
      root.remove();
      resolve(action === 'skip' ? 'skip' : 'continue');
    };

    root.querySelector('[data-ads-action="continue"]')?.addEventListener('click', () => {
      finish('continue');
    });
    root.querySelector('[data-ads-action="skip"]')?.addEventListener('click', () => {
      finish('skip');
    });

    // Focus primary for a11y
    try {
      /** @type {HTMLButtonElement | null} */
      const primary = root.querySelector('[data-ads-action="continue"]');
      primary?.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
  });
}

/**
 * Maybe show interstitial before advancing; always resolves.
 * @param {Parameters<typeof shouldShow>[0] & { config?: import('./config.js').AdsConfig }} gate
 * @param {(g: typeof gate) => boolean} shouldShow
 * @returns {Promise<void>}
 */
export async function maybeShowInterstitial(gate, shouldShow) {
  const cfg = gate.config || getAdsConfig();
  const show = shouldShow({ ...gate, adsEnabled: cfg.enabled });
  if (!show) return;
  await showInterstitial({ config: cfg, reason: gate.reason });
}

/** Test helper */
export function __resetAdSenseScriptForTests() {
  scriptInjected = false;
  if (typeof document !== 'undefined') {
    document.querySelectorAll(`script[${SCRIPT_ATTR}]`).forEach((n) => n.remove());
    document.getElementById(ROOT_ID)?.remove();
  }
}
