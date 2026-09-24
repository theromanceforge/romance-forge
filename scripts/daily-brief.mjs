#!/usr/bin/env node
/**
 * Romance Forge daily stats brief (read-only).
 *
 * Uses SUPABASE_SECRET_KEY + VITE_SUPABASE_URL from .env.local (never printed) to read
 * public.events, public.reviews and auth users for the last 24h, with a 7-day comparison.
 * Prints the plain-text brief to stdout and writes text + HTML files to
 * /workspace/romance-forge-brief/ (override with BRIEF_OUT_DIR). `--html` prints HTML instead.
 * Sends nothing — no email, no schedule.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = process.env.BRIEF_OUT_DIR || '/workspace/romance-forge-brief';
const TZ = 'America/New_York';
const DAY = 24 * 60 * 60 * 1000;

const STORY_TITLES = {
  'until-the-quiet-breaks': 'Until the Quiet Breaks',
  'what-the-sister-kept': 'What the Sister Kept',
  'the-living-key': 'The Living Key',
  'the-soft-alibi': 'The Soft Alibi',
};
const STORY_IDS = Object.keys(STORY_TITLES);

function loadEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const env = { ...loadEnv(path.join(root, '.env.local')), ...process.env };
const url = env.VITE_SUPABASE_URL;
const secret = env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error('BLOCKER: need VITE_SUPABASE_URL + SUPABASE_SECRET_KEY in .env.local');
  process.exit(1);
}
const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

const now = new Date();
const since24 = new Date(now.getTime() - DAY);
const since8d = new Date(now.getTime() - 8 * DAY);

const fmtTime = (d) =>
  d.toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET';
const dateStamp = now.toLocaleDateString('en-CA', { timeZone: TZ });

async function fetchAll(table, columns, sinceIso) {
  const rows = [];
  const page = 1000;
  for (let from = 0; from < 200_000; from += page) {
    const { data, error } = await admin
      .from(table)
      .select(columns)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .range(from, from + page - 1);
    if (error) return { rows, error };
    rows.push(...(data || []));
    if (!data || data.length < page) break;
  }
  return { rows, error: null };
}

async function fetchSignups() {
  let total24 = 0;
  let total7 = 0;
  try {
    for (let pageNo = 1; pageNo <= 50; pageNo += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page: pageNo, perPage: 1000 });
      if (error) return { error };
      const users = data?.users || [];
      for (const u of users) {
        const t = new Date(u.created_at).getTime();
        if (t >= since24.getTime()) total24 += 1;
        else if (t >= since8d.getTime()) total7 += 1;
      }
      if (users.length < 1000) break;
    }
    return { total24, total7, error: null };
  } catch (e) {
    return { error: e };
  }
}

const count = (arr, fn) => {
  const m = new Map();
  for (const x of arr) {
    const k = fn(x);
    if (k === undefined || k === null || k === '') continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
};
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');
const title = (id) => STORY_TITLES[id] || id || '(unknown)';
function vs(cur, prev7) {
  const avg = prev7 / 7;
  const avgStr = avg >= 10 || avg === 0 ? String(Math.round(avg)) : avg.toFixed(1);
  if (!prev7) return cur ? '(no prior-week data)' : '';
  if (avg < 1) return `(7-day avg ${avgStr}/day)`;
  const diff = Math.round(((cur - avg) / avg) * 100);
  return `(7-day avg ${avgStr}/day, ${diff >= 0 ? '+' : ''}${diff}%)`;
}

function summarize(events) {
  const views = events.filter((e) => e.event === 'page_view');
  const sessions = new Set(events.map((e) => e.session_id));
  const byEvent = (name) => events.filter((e) => e.event === name);
  return { events, views, sessions, byEvent };
}

const [evRes, revRes, signups] = await Promise.all([
  fetchAll(
    'events',
    'created_at,session_id,event,story_id,spice,layer,scene_id,referrer_host,utm_source,utm_medium,utm_campaign,player_name,meta',
    since8d.toISOString()
  ),
  fetchAll('reviews', 'created_at,stars,story_slug', since8d.toISOString()),
  fetchSignups(),
]);

const eventsMissing = Boolean(evRes.error);
const allEvents = evRes.rows;
const cur = summarize(allEvents.filter((e) => new Date(e.created_at) >= since24));
const prev = summarize(allEvents.filter((e) => new Date(e.created_at) < since24));
const testEvents = cur.events.filter((e) => e.meta && e.meta.test === true).length;

/** @type {{ heading: string, lines: string[], table?: string[][] }[]} */
const sections = [];
const add = (heading, lines, table) => sections.push({ heading, lines, table });

// Traffic
if (eventsMissing) {
  add('Traffic', [
    `Events table not reachable (${evRes.error.code || ''} ${evRes.error.message || 'error'}).`.replace(/\s+/g, ' '),
    'Apply scripts/apply-events-schema.sql (npm run schema:events or Supabase SQL Editor).',
  ]);
} else if (!cur.events.length) {
  add('Traffic', ['No visits yet in the last 24h.', prev.events.length ? `Prior 7 days: ${prev.sessions.size} visitors, ${prev.views.length} page views.` : 'No events recorded in the prior 7 days either.']);
} else {
  const lines = [
    `Unique visitors (sessions): ${cur.sessions.size} ${vs(cur.sessions.size, prev.sessions.size)}`.trim(),
    `Page views: ${cur.views.length} ${vs(cur.views.length, prev.views.length)}`.trim(),
    `Total events: ${cur.events.length}${testEvents ? ` (includes ${testEvents} test event${testEvents === 1 ? '' : 's'})` : ''}`,
  ];
  add('Traffic', lines);
  const refs = count(cur.views, (e) => e.referrer_host || (e.utm_source ? null : '(direct / none)')).slice(0, 5);
  const utm = count(cur.views.filter((e) => e.utm_source), (e) =>
    [e.utm_source, e.utm_medium, e.utm_campaign].filter(Boolean).join(' / ')
  ).slice(0, 5);
  add('Top referrers', refs.length ? refs.map(([k, n]) => `${k}: ${n}`) : ['None recorded.']);
  if (utm.length) add('Top campaigns (UTM)', utm.map(([k, n]) => `${k}: ${n}`));
}

// Stories
if (!eventsMissing && cur.events.length) {
  const clicks = cur.byEvent('story_click');
  const starts = cur.byEvent('story_start');
  const completes = cur.byEvent('story_complete');
  const table = [['Story', 'Clicks', 'Starts', 'Completes', 'Most drop-off (deepest layer reached by non-finishers)']];
  const ids = [...new Set([...STORY_IDS, ...cur.events.map((e) => e.story_id).filter(Boolean)])];
  for (const id of ids) {
    const mine = cur.events.filter((e) => e.story_id === id);
    if (!mine.length && !STORY_TITLES[id]) continue;
    const c = clicks.filter((e) => e.story_id === id).length;
    const s = starts.filter((e) => e.story_id === id).length;
    const done = completes.filter((e) => e.story_id === id);
    // Deepest layer per session for this story
    const deepest = new Map();
    const finished = new Set(done.map((e) => e.session_id));
    for (const e of mine) {
      if (typeof e.layer !== 'number') continue;
      deepest.set(e.session_id, Math.max(deepest.get(e.session_id) || 0, e.layer));
    }
    const stops = count([...deepest.entries()].filter(([sid]) => !finished.has(sid)), ([, l]) => l);
    let drop = '—';
    if (stops.length) {
      const [layer, n] = stops[0];
      const dist = [...stops].sort((a, b) => a[0] - b[0]).map(([l, k]) => `L${l}×${k}`).join(' ');
      drop = `L${layer} (${n} reader${n === 1 ? '' : 's'}); ${dist}`;
    }
    table.push([title(id), String(c), String(s), String(new Set(done.map((e) => e.session_id)).size || done.length), drop]);
  }
  const lines = [];
  if (!clicks.length && !starts.length) lines.push('No story clicks or starts yet.');
  add('Stories (last 24h)', lines, table);

  const warm = starts.filter((e) => e.spice === 'warm').length;
  const hot = starts.filter((e) => e.spice === 'hot').length;
  add('Warm vs Hot (story starts)', warm + hot
    ? [`Warm: ${warm} (${pct(warm, warm + hot)})`, `Hot: ${hot} (${pct(hot, warm + hot)})`]
    : ['No starts yet.']);

  const names = count(starts, (e) => e.player_name).slice(0, 5);
  add('Top 5 player names', names.length ? names.map(([k, n], i) => `${i + 1}. ${k} (${n})`) : ['No names yet.']);

  const ads = cur.byEvent('ad_shown');
  const adReasons = count(ads, (e) => e.meta?.reason);
  add('Ads', [
    `Interstitials shown: ${ads.length} ${vs(ads.length, prev.byEvent('ad_shown').length)}`.trim(),
    ...(adReasons.length ? [adReasons.map(([k, n]) => `${k}: ${n}`).join(', ')] : []),
  ]);

  const outbound = cur.byEvent('outbound_click');
  const choices = cur.byEvent('choice');
  add('Engagement', [
    `Choices made: ${choices.length}`,
    `Scene views: ${cur.byEvent('scene_view').length}`,
    `Outbound clicks: ${outbound.length}${outbound.length ? ` (${count(outbound, (e) => e.meta?.target).map(([k, n]) => `${k} ${n}`).join(', ')})` : ''}`,
  ]);
}

// Reviews
{
  const lines = [];
  if (revRes.error) {
    lines.push(`Cloud reviews table not reachable (${revRes.error.message || 'error'}).`);
  } else {
    const r24 = revRes.rows.filter((r) => new Date(r.created_at) >= since24);
    const avg = r24.length ? (r24.reduce((a, r) => a + r.stars, 0) / r24.length).toFixed(1) : null;
    lines.push(r24.length ? `New signed-in reviews: ${r24.length} (avg ${avg}★)` : 'New signed-in reviews: 0');
  }
  if (!eventsMissing) {
    const sub = cur.byEvent('review_submitted');
    const stars = sub.map((e) => Number(e.meta?.stars)).filter((n) => n >= 1 && n <= 5);
    const avg = stars.length ? (stars.reduce((a, b) => a + b, 0) / stars.length).toFixed(1) : null;
    lines.push(sub.length
      ? `Reviews submitted (all readers incl. guests): ${sub.length}${avg ? ` (avg ${avg}★)` : ''}`
      : 'Reviews submitted (all readers incl. guests): 0');
  }
  add('Reviews', lines);
}

// Signups
{
  const lines = [];
  if (signups.error) lines.push(`Auth users not queryable (${signups.error.message || 'error'}).`);
  else lines.push(`New accounts: ${signups.total24} ${vs(signups.total24, signups.total7)}`.trim());
  if (!eventsMissing) lines.push(`Signup form completions (events): ${cur.byEvent('signup').length}`);
  add('Signups', lines);
}

// ---- Render
const header = `Romance Forge — Daily Brief (${dateStamp})`;
const windowLine = `Window: ${fmtTime(since24)} → ${fmtTime(now)} · comparison: prior 7 days`;

function pad(s, n) {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}
function textTable(rows) {
  const w = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  const lines = rows.map((r) => r.map((c, i) => (i === r.length - 1 ? c : pad(c, w[i]))).join('  '));
  lines.splice(1, 0, w.map((n, i) => '-'.repeat(i === w.length - 1 ? Math.min(n, 40) : n)).join('  '));
  return lines;
}

const text = [
  header,
  '='.repeat(header.length),
  windowLine,
  '',
  ...sections.flatMap((s) => [
    s.heading,
    '-'.repeat(s.heading.length),
    ...s.lines.map((l) => `  ${l}`),
    ...(s.table ? textTable(s.table).map((l) => `  ${l}`) : []),
    '',
  ]),
  'Source: first-party events (public.events), public.reviews, Supabase Auth. Sessions = random browser ids, no PII.',
].join('\n');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(header)}</title></head>
<body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#2a1f24;max-width:680px;margin:0 auto;padding:16px">
<h1 style="font-size:20px;margin:0 0 4px;color:#7a2440">${esc(header)}</h1>
<p style="margin:0 0 16px;color:#6b5a60;font-size:13px">${esc(windowLine)}</p>
${sections
  .map(
    (s) => `<h2 style="font-size:15px;margin:18px 0 6px;border-bottom:1px solid #eadde2;padding-bottom:4px">${esc(s.heading)}</h2>
${s.lines.length ? `<ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.5">${s.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
${s.table
  ? `<table style="border-collapse:collapse;font-size:13px;width:100%;margin-top:6px">${s.table
      .map(
        (r, i) =>
          `<tr>${r
            .map((c) =>
              i === 0
                ? `<th style="text-align:left;padding:4px 6px;background:#f7eef1">${esc(c)}</th>`
                : `<td style="padding:4px 6px;border-top:1px solid #f0e6ea">${esc(c)}</td>`
            )
            .join('')}</tr>`
      )
      .join('')}</table>`
  : ''}`
  )
  .join('\n')}
<p style="margin-top:20px;font-size:12px;color:#8a7a80">Source: first-party events (public.events), public.reviews, Supabase Auth. Sessions = random browser ids, no PII.</p>
</body></html>
`;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, `brief-${dateStamp}.txt`), text + '\n');
fs.writeFileSync(path.join(OUT_DIR, `brief-${dateStamp}.html`), html);
fs.writeFileSync(path.join(OUT_DIR, 'latest.txt'), text + '\n');
fs.writeFileSync(path.join(OUT_DIR, 'latest.html'), html);

console.log(process.argv.includes('--html') ? html : text);
console.error(`\n[brief] wrote ${path.join(OUT_DIR, `brief-${dateStamp}.{txt,html}`)} (+ latest.*)`);
