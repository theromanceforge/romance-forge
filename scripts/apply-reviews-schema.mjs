#!/usr/bin/env node
/**
 * Apply public.reviews + RLS using SUPABASE_SECRET_KEY from .env.local.
 * Tries project pg-meta / Management SQL endpoints. Never prints key values.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env.local');
const sqlPath = path.join(root, 'scripts/apply-reviews-schema.sql');

function loadEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    env[t.slice(0, i)] = t.slice(i + 1);
  }
  return env;
}

function mask(s) {
  if (!s) return '(missing)';
  return `${s.slice(0, 8)}…(len=${s.length})`;
}

const env = loadEnv(envPath);
const url = env.VITE_SUPABASE_URL;
const secret = env.SUPABASE_SECRET_KEY;
const sql = fs.readFileSync(sqlPath, 'utf8');

if (!url || !secret) {
  console.error('BLOCKER: need VITE_SUPABASE_URL + SUPABASE_SECRET_KEY in .env.local');
  process.exit(1);
}

console.log('Project URL host:', new URL(url).host);
console.log('Secret key present:', mask(secret).startsWith('sb_secret') || secret.length > 0 ? 'yes' : 'no');

const endpoints = [
  `${url}/pg/query`,
  `${url}/pg-meta/default/query`,
];

let applied = false;
for (const ep of endpoints) {
  try {
    const res = await fetch(ep, {
      method: 'POST',
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });
    const text = await res.text();
    console.log('DDL attempt', ep.replace(url, '<project>'), '→', res.status);
    if (res.ok) {
      applied = true;
      console.log('Schema applied via', ep.replace(url, '<project>'));
      break;
    }
    if (text) console.log('  body:', text.slice(0, 160).replace(/\s+/g, ' '));
  } catch (e) {
    console.log('DDL attempt error', e.message);
  }
}

// Probe whether table already exists (service client)
const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { error: probeErr } = await admin.from('reviews').select('user_id').limit(1);
if (!probeErr) {
  console.log('PROBE: public.reviews reachable — schema OK (or already applied)');
  process.exit(0);
}
console.log('PROBE: reviews table →', probeErr.message || probeErr.code || 'error');

if (!applied) {
  console.error('');
  console.error('BLOCKER: Could not apply DDL programmatically.');
  console.error('Open Supabase Dashboard → SQL Editor and run:');
  console.error('  scripts/apply-reviews-schema.sql');
  process.exit(2);
}
