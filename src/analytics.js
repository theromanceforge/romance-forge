/**
 * First-party, fire-and-forget usage tracker → Supabase `public.events` (insert-only RLS).
 *
 * Guarantees:
 * - `track()` is synchronous, never awaits, never throws, never blocks navigation.
 * - Events are queued and flushed in small batches (timer / batch size / pagehide).
 * - No-ops when Supabase env is missing, when VITE_ANALYTICS_ENABLED is false/0/off,
 *   under the vitest runner, or on localhost unless the flag is explicitly "true".
 * - No PII: session id is random (localStorage); player name is only sent on
 *   story_start as a trimmed, lowercased first name capped at 24 chars.
 */

import { getSupabaseClient } from './auth/supabaseClient.js';

export const EVENTS = Object.freeze([
  'page_view',
  'story_click',
  'story_start',
  'scene_view',
  'choice',
  'story_complete',
  'ad_shown',
  'review_submitted',
  'signup',
  'outbound_click',
]);

const EVENT_SET = new Set(EVENTS);
const SID_KEY = 'romanceForge.analytics.sid';
const FIRST_VIEW_KEY = 'romanceForge.analytics.firstView';
export const FLUSH_MS = 2000;
export const MAX_BATCH = 20;
const MAX_QUEUE = 100;
const DEDUPE_MS = 1500;
const MAX_FAILURES = 3;

/** @type {any[]} */
let queue = [];
let timer = null;
let failures = 0;
let disabled = false;
let inflight = 0;
/** @type {Map<string, number>} */
const recent = new Map();
/** @type {null | { client?: any, enabled?: boolean, now?: () => number, fetch?: any }} */
let overrides = null;
let unloadBound = false;

function env() {
  try {
    return import.meta.env || {};
  } catch {
    return {};
  }
}

function now() {
  return overrides?.now ? overrides.now() : Date.now();
}

/** @returns {boolean} */
export function isAnalyticsEnabled() {
  try {
    if (disabled) return false;
    if (overrides && typeof overrides.enabled === 'boolean') return overrides.enabled;
    const e = env();
    const flag = String(e.VITE_ANALYTICS_ENABLED ?? '').trim().toLowerCase();
    if (flag === 'false' || flag === '0' || flag === 'off' || flag === 'no') return false;
    if (e.MODE === 'test' || e.VITEST) return false;
    const url = e.VITE_SUPABASE_URL;
    const key = e.VITE_SUPABASE_ANON_KEY || e.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return false;
    const host = typeof location !== 'undefined' ? location.hostname : '';
    if ((host === 'localhost' || host === '127.0.0.1') && flag !== 'true') return false;
    return true;
  } catch {
    return false;
  }
}

function randomId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID().replace(/-/g, '');
    }
  } catch {
    /* fall through */
  }
  let s = '';
  for (let i = 0; i < 32; i += 1) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

let memorySid = '';
/** Random, non-PII browser id kept in localStorage. */
export function getSessionId() {
  try {
    const existing = localStorage.getItem(SID_KEY);
    if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;
    const id = randomId();
    localStorage.setItem(SID_KEY, id);
    return id;
  } catch {
    if (!memorySid) memorySid = randomId();
    return memorySid;
  }
}

/**
 * Trimmed, lowercased first name capped at 24 chars ('' when unusable).
 * @param {unknown} name
 */
export function normalizePlayerName(name) {
  const first = String(name ?? '').trim().split(/\s+/)[0] || '';
  return first.toLowerCase().slice(0, 24);
}

function str(v, max) {
  if (v === undefined || v === null || v === '') return null;
  return String(v).slice(0, max);
}

function cleanMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
  /** @type {Record<string, string | number | boolean | null>} */
  const out = {};
  let n = 0;
  for (const [k, v] of Object.entries(meta)) {
    if (n >= 12) break;
    const key = String(k).slice(0, 32);
    if (typeof v === 'number' || typeof v === 'boolean' || v === null) out[key] = v;
    else if (v !== undefined) out[key] = String(v).slice(0, 120);
    else continue;
    n += 1;
  }
  return out;
}

function currentPath() {
  try {
    return typeof location !== 'undefined' ? location.pathname : null;
  } catch {
    return null;
  }
}

/** External referrer host + UTM params (only for the first page_view of a tab session). */
function firstViewContext() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (sessionStorage.getItem(FIRST_VIEW_KEY)) return null;
      sessionStorage.setItem(FIRST_VIEW_KEY, '1');
    }
    let referrerHost = null;
    if (typeof document !== 'undefined' && document.referrer) {
      const h = new URL(document.referrer).hostname;
      if (h && h !== location.hostname) referrerHost = h;
    }
    const q = new URLSearchParams(location.search || '');
    return {
      referrer_host: referrerHost,
      utm_source: q.get('utm_source'),
      utm_medium: q.get('utm_medium'),
      utm_campaign: q.get('utm_campaign'),
    };
  } catch {
    return null;
  }
}

/**
 * @param {string} event
 * @param {Record<string, any>} props
 */
export function buildRow(event, props = {}) {
  const layer = Number(props.layer);
  const spice = props.spice === 'warm' || props.spice === 'hot' ? props.spice : null;
  const row = {
    session_id: getSessionId(),
    event,
    story_id: props.storyId && /^[a-z0-9-]{1,64}$/.test(String(props.storyId)) ? String(props.storyId) : null,
    spice,
    layer: Number.isInteger(layer) && layer >= 0 && layer <= 20 ? layer : null,
    scene_id: str(props.sceneId, 64),
    path: str(props.path ?? currentPath(), 200),
    referrer_host: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    player_name: null,
    meta: cleanMeta(props.meta),
  };
  if (event === 'story_start') {
    const name = normalizePlayerName(props.playerName);
    row.player_name = name || null;
  }
  if (event === 'page_view') {
    const ctx = firstViewContext();
    if (ctx) {
      row.referrer_host = str(ctx.referrer_host, 120);
      row.utm_source = str(ctx.utm_source, 100);
      row.utm_medium = str(ctx.utm_medium, 100);
      row.utm_campaign = str(ctx.utm_campaign, 100);
    }
  }
  return row;
}

function dedupeKey(event, props) {
  if (event === 'choice' || event === 'ad_shown' || event === 'review_submitted' || event === 'signup') {
    return '';
  }
  return [event, props.storyId || '', props.sceneId || '', props.path || '', props.meta?.via || ''].join('|');
}

function isDuplicate(key) {
  if (!key) return false;
  const t = now();
  const prev = recent.get(key);
  recent.set(key, t);
  if (recent.size > 200) {
    for (const [k, v] of recent) {
      if (t - v > DEDUPE_MS) recent.delete(k);
    }
  }
  return prev !== undefined && t - prev < DEDUPE_MS;
}

function getClient() {
  if (overrides && 'client' in overrides) return overrides.client;
  try {
    return getSupabaseClient();
  } catch {
    return null;
  }
}

function onFailure(err) {
  failures += 1;
  const code = err?.code || '';
  // Table missing / not permitted → stop trying for this page load.
  if (failures >= MAX_FAILURES || code === 'PGRST205' || code === '42P01' || code === '42501') {
    disabled = true;
    queue = [];
  }
}

/** Unload path: keepalive fetch straight to PostgREST with the public key. */
function sendKeepalive(rows) {
  try {
    const e = env();
    const url = e.VITE_SUPABASE_URL;
    const key = e.VITE_SUPABASE_ANON_KEY || e.VITE_SUPABASE_PUBLISHABLE_KEY;
    const f = overrides?.fetch || (typeof fetch === 'function' ? fetch : null);
    if (!url || !key || !f) return false;
    const p = f(`${url}/rest/v1/events`, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(rows),
    });
    if (p && typeof p.catch === 'function') p.catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Send queued rows. Never throws; resolves when the request settles (tests only).
 * @param {{ unloading?: boolean }} [opts]
 */
export function flush(opts = {}) {
  try {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!queue.length || disabled) return Promise.resolve();
    const rows = queue.splice(0, MAX_BATCH);
    if (queue.length) schedule(0);
    if (opts.unloading && sendKeepalive(rows)) return Promise.resolve();
    const client = getClient();
    if (!client) return Promise.resolve();
    inflight += 1;
    return Promise.resolve()
      .then(() => client.from('events').insert(rows))
      .then((res) => {
        if (res && res.error) onFailure(res.error);
        else failures = 0;
      })
      .catch((err) => onFailure(err))
      .finally(() => {
        inflight -= 1;
      });
  } catch {
    return Promise.resolve();
  }
}

function schedule(ms) {
  if (timer) return;
  try {
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, ms);
  } catch {
    /* ignore */
  }
}

function bindUnload() {
  if (unloadBound || typeof window === 'undefined') return;
  unloadBound = true;
  try {
    const onHide = () => flush({ unloading: true });
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') onHide();
    });
  } catch {
    /* ignore */
  }
}

/**
 * Fire-and-forget event. Synchronous; never throws.
 * @param {string} event one of EVENTS
 * @param {{ storyId?: string, spice?: string, layer?: number, sceneId?: string, path?: string, playerName?: string, meta?: Record<string, any> }} [props]
 */
export function track(event, props = {}) {
  try {
    if (!EVENT_SET.has(event) || !isAnalyticsEnabled()) return;
    const p = props && typeof props === 'object' ? props : {};
    if (isDuplicate(dedupeKey(event, p))) return;
    queue.push(buildRow(event, p));
    if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
    bindUnload();
    if (queue.length >= MAX_BATCH) {
      if (timer) clearTimeout(timer);
      timer = null;
      schedule(0);
    } else {
      schedule(FLUSH_MS);
    }
  } catch {
    /* never throw from analytics */
  }
}

/**
 * One document-level listener for outbound links (mailto + external http).
 * Does not preventDefault or delay navigation.
 */
export function bindOutboundTracking(root = typeof document !== 'undefined' ? document : null) {
  try {
    if (!root || root.__rfOutboundBound) return;
    root.__rfOutboundBound = true;
    root.addEventListener(
      'click',
      (e) => {
        try {
          const a = e.target && typeof e.target.closest === 'function' ? e.target.closest('a[href]') : null;
          if (!a) return;
          const href = a.getAttribute('href') || '';
          let kind = '';
          let target = '';
          if (href.startsWith('mailto:')) {
            kind = 'mailto';
            target = a.getAttribute('data-testid') || 'mailto';
          } else if (/^https?:\/\//i.test(href)) {
            const u = new URL(href);
            if (u.hostname === location.hostname) return;
            kind = 'link';
            target = u.hostname;
          } else {
            return;
          }
          track('outbound_click', { meta: { kind, target } });
        } catch {
          /* ignore */
        }
      },
      { capture: true, passive: true }
    );
  } catch {
    /* ignore */
  }
}

/** Test helpers. */
export function __configureAnalyticsForTests(o) {
  overrides = o;
}
export function __resetAnalyticsForTests() {
  if (timer) clearTimeout(timer);
  timer = null;
  queue = [];
  failures = 0;
  disabled = false;
  inflight = 0;
  recent.clear();
  overrides = null;
  memorySid = '';
}
export function __getQueueForTests() {
  return queue.slice();
}
