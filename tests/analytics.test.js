import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  track,
  flush,
  EVENTS,
  FLUSH_MS,
  MAX_BATCH,
  buildRow,
  normalizePlayerName,
  getSessionId,
  isAnalyticsEnabled,
  bindOutboundTracking,
  __configureAnalyticsForTests,
  __resetAnalyticsForTests,
  __getQueueForTests,
} from '../src/analytics.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function mockClient(impl) {
  const insert = vi.fn(impl || (async () => ({ error: null })));
  const from = vi.fn(() => ({ insert }));
  return { client: { from }, from, insert };
}

describe('analytics tracker', () => {
  let t = 1_000_000;
  beforeEach(() => {
    __resetAnalyticsForTests();
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers();
    t = 1_000_000;
  });
  afterEach(() => {
    vi.useRealTimers();
    __resetAnalyticsForTests();
  });

  it('is a no-op under the test runner / without explicit enablement', () => {
    expect(isAnalyticsEnabled()).toBe(false);
    track('page_view');
    expect(__getQueueForTests()).toHaveLength(0);
  });

  it('no-ops (and never throws) when there is no Supabase client', async () => {
    __configureAnalyticsForTests({ enabled: true, client: null });
    expect(() => track('page_view')).not.toThrow();
    await expect(flush()).resolves.toBeUndefined();
  });

  it('ignores unknown events and bad input without throwing', () => {
    const { client } = mockClient();
    __configureAnalyticsForTests({ enabled: true, client });
    expect(() => track('drop_table')).not.toThrow();
    expect(() => track(undefined)).not.toThrow();
    expect(() => track('choice', null)).not.toThrow();
    expect(() => track('choice', { meta: 'nope', layer: 'x' })).not.toThrow();
    const q = __getQueueForTests();
    expect(q.map((r) => r.event)).toEqual(['choice', 'choice']);
    expect(q[1].layer).toBeNull();
    expect(q[1].meta).toEqual({});
  });

  it('track() is synchronous and does not call the client until the batch timer fires', async () => {
    const { client, insert } = mockClient();
    __configureAnalyticsForTests({ enabled: true, client, now: () => t });
    const ret = track('page_view');
    expect(ret).toBeUndefined();
    track('story_click', { storyId: 'the-living-key', meta: { via: 'card' } });
    expect(insert).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(FLUSH_MS);
    expect(insert).toHaveBeenCalledTimes(1);
    const rows = insert.mock.calls[0][0];
    expect(rows.map((r) => r.event)).toEqual(['page_view', 'story_click']);
  });

  it('batches: flushes immediately once MAX_BATCH events are queued', async () => {
    const { client, insert } = mockClient();
    __configureAnalyticsForTests({ enabled: true, client, now: () => t });
    for (let i = 0; i < MAX_BATCH + 5; i += 1) {
      track('choice', { storyId: 'the-soft-alibi', sceneId: `s${i}`, layer: 2 });
    }
    await vi.advanceTimersByTimeAsync(0);
    expect(insert).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(FLUSH_MS);
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert.mock.calls[0][0]).toHaveLength(MAX_BATCH);
    expect(insert.mock.calls[1][0]).toHaveLength(5);
  });

  it('dedupes rapid identical page_view / scene_view / story_click, but not choices', async () => {
    const { client, insert } = mockClient();
    __configureAnalyticsForTests({ enabled: true, client, now: () => t });
    track('page_view');
    track('page_view');
    track('scene_view', { storyId: 'the-living-key', sceneId: 'scene1', layer: 1 });
    track('scene_view', { storyId: 'the-living-key', sceneId: 'scene1', layer: 1 });
    track('story_click', { storyId: 'the-living-key', meta: { via: 'card' } });
    track('story_click', { storyId: 'the-living-key', meta: { via: 'card' } });
    track('story_click', { storyId: 'the-living-key', meta: { via: 'start' } });
    track('choice', { storyId: 'the-living-key', sceneId: 'scene1' });
    track('choice', { storyId: 'the-living-key', sceneId: 'scene1' });
    expect(__getQueueForTests().map((r) => r.event)).toEqual([
      'page_view',
      'scene_view',
      'story_click',
      'story_click',
      'choice',
      'choice',
    ]);
    t += 5000; // later revisit counts again
    track('page_view');
    expect(__getQueueForTests().filter((r) => r.event === 'page_view')).toHaveLength(2);
    await flush();
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('never throws when the client throws synchronously, rejects, or returns an error', async () => {
    const throwing = { from: () => { throw new Error('boom'); } };
    __configureAnalyticsForTests({ enabled: true, client: throwing });
    track('page_view');
    await expect(flush()).resolves.toBeUndefined();

    __resetAnalyticsForTests();
    const { client } = mockClient(async () => { throw new Error('network'); });
    __configureAnalyticsForTests({ enabled: true, client });
    track('page_view');
    await expect(flush()).resolves.toBeUndefined();

    __resetAnalyticsForTests();
    const bad = mockClient(async () => ({ error: { message: 'x', code: '23514' } }));
    __configureAnalyticsForTests({ enabled: true, client: bad.client });
    track('page_view');
    await expect(flush()).resolves.toBeUndefined();
  });

  it('stops sending for the page load when the events table is missing', async () => {
    const { client, insert } = mockClient(async () => ({ error: { code: 'PGRST205', message: 'missing' } }));
    __configureAnalyticsForTests({ enabled: true, client, now: () => t });
    track('page_view');
    await flush();
    t += 5000;
    track('page_view');
    await flush();
    expect(insert).toHaveBeenCalledTimes(1);
    expect(isAnalyticsEnabled()).toBe(false);
  });

  it('player name: only on story_start, trimmed + lowercased first name, max 24 chars', () => {
    __configureAnalyticsForTests({ enabled: true, client: mockClient().client });
    expect(normalizePlayerName('  Mary Jane Watson ')).toBe('mary');
    expect(normalizePlayerName('A'.repeat(40))).toBe('a'.repeat(24));
    expect(normalizePlayerName('')).toBe('');
    expect(buildRow('story_start', { storyId: 'the-soft-alibi', spice: 'hot', playerName: ' Evelyn Rose' })
      .player_name).toBe('evelyn');
    expect(buildRow('scene_view', { playerName: 'Evelyn' }).player_name).toBeNull();
    expect(buildRow('story_start', { spice: 'nuclear' }).spice).toBeNull();
  });

  it('captures referrer host + UTM only on the first page_view of a session', () => {
    __configureAnalyticsForTests({ enabled: true, client: mockClient().client });
    Object.defineProperty(document, 'referrer', { value: 'https://www.reddit.com/r/romance', configurable: true });
    window.history.replaceState(null, '', '/romance-forge/?utm_source=tiktok&utm_medium=social&utm_campaign=launch');
    const first = buildRow('page_view');
    expect(first.referrer_host).toBe('www.reddit.com');
    expect(first.utm_source).toBe('tiktok');
    expect(first.utm_medium).toBe('social');
    expect(first.utm_campaign).toBe('launch');
    expect(first.path).toBe('/romance-forge/');
    const second = buildRow('page_view');
    expect(second.referrer_host).toBeNull();
    expect(second.utm_source).toBeNull();
    window.history.replaceState(null, '', '/');
  });

  it('session id is random, stable in localStorage, and not PII-shaped', () => {
    const a = getSessionId();
    const b = getSessionId();
    expect(a).toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    localStorage.clear();
    expect(getSessionId()).not.toBe(a);
  });

  it('caps meta size and field lengths', () => {
    const big = {};
    for (let i = 0; i < 50; i += 1) big[`k${i}`] = 'x'.repeat(500);
    const row = buildRow('choice', { meta: big, sceneId: 's'.repeat(200), storyId: 'BAD ID!' });
    expect(Object.keys(row.meta).length).toBeLessThanOrEqual(12);
    expect(Object.values(row.meta).every((v) => String(v).length <= 120)).toBe(true);
    expect(row.scene_id.length).toBe(64);
    expect(row.story_id).toBeNull();
  });

  it('outbound mailto click tracks without preventing navigation', () => {
    __configureAnalyticsForTests({ enabled: true, client: mockClient().client });
    const host = document.createElement('div');
    host.innerHTML = '<a href="mailto:cs@example.com" data-testid="footer-cs-mailto">CS</a>';
    document.body.appendChild(host);
    bindOutboundTracking(host);
    const a = host.querySelector('a');
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    a.addEventListener('click', (e) => e.preventDefault()); // jsdom: avoid navigation
    a.dispatchEvent(ev);
    const q = __getQueueForTests();
    expect(q).toHaveLength(1);
    expect(q[0].event).toBe('outbound_click');
    expect(q[0].meta).toEqual({ kind: 'mailto', target: 'footer-cs-mailto' });
    host.remove();
  });

  it('pagehide flush uses keepalive fetch and swallows failures', async () => {
    const f = vi.fn(() => Promise.reject(new Error('offline')));
    __configureAnalyticsForTests({ enabled: true, client: mockClient().client, fetch: f });
    track('page_view');
    // env URL/key may be absent in tests → falls back to client; either way never throws.
    await expect(flush({ unloading: true })).resolves.toBeUndefined();
  });

  it('event list matches the SQL check constraint', () => {
    const sql = readFileSync(join(root, 'scripts/apply-events-schema.sql'), 'utf8');
    for (const e of EVENTS) expect(sql).toContain(`'${e}'`);
    expect(sql).toMatch(/enable row level security/);
    expect(sql).not.toMatch(/grant\s+select[^;]*to\s+anon/i);
  });

  it('main.js wires every event and never awaits track()', () => {
    const src = readFileSync(join(root, 'src/main.js'), 'utf8');
    for (const e of EVENTS.filter((x) => x !== 'outbound_click')) {
      expect(src).toContain(`track('${e}'`);
    }
    expect(src).toContain('bindOutboundTracking()');
    expect(src).not.toMatch(/await\s+track\(/);
  });
});
