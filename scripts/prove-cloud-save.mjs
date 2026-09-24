#!/usr/bin/env node
/**
 * Prove: login → save mid-path → resume for until-the-quiet-breaks.
 * Uses SUPABASE_SECRET_KEY only in this script (admin createUser). Never prints secrets.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORY = 'until-the-quiet-breaks';
const MID_SCENE = 'scene2a';
const MID_PATH = ['scene1', 'scene2a'];

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

function fail(msg, detail) {
  console.error('PROVE FAIL:', msg);
  if (detail) console.error(' ', String(detail).slice(0, 300));
  process.exit(1);
}

const env = loadEnv(path.join(root, '.env.local'));
const url = env.VITE_SUPABASE_URL;
const anon = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const secret = env.SUPABASE_SECRET_KEY;

if (!url || !anon || !secret) fail('missing env keys in .env.local');

const stamp = Date.now();
const email = `rf-prove-${stamp}@example.com`;
const password = `Prove_${stamp}_Aa1!`;

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const userClient = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log('PROVE start');
console.log('  project:', new URL(url).host);
console.log('  story:', STORY);
console.log('  mid scene:', MID_SCENE);

// 1) Admin create throwaway user (no email confirm)
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (createErr || !created?.user?.id) {
  fail('admin createUser', createErr?.message || 'no user');
}
const userId = created.user.id;
console.log('  user created: yes (id prefix', userId.slice(0, 8) + '…)');

try {
  // 2) Sign in with publishable client (login)
  const { data: signed, error: signErr } = await userClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signErr || !signed?.session) fail('signInWithPassword', signErr?.message);
  console.log('  login: ok');

  // 3) Save mid-path
  const row = {
    user_id: userId,
    story_slug: STORY,
    scene_id: MID_SCENE,
    path: MID_PATH,
    updated_at: new Date().toISOString(),
  };
  const { error: upsertErr } = await userClient.from('saves').upsert(row, {
    onConflict: 'user_id,story_slug',
  });
  if (upsertErr) fail('upsert saves', upsertErr.message);
  console.log('  save mid-path: ok');

  // 4) Sign out + sign in again, read back (resume)
  await userClient.auth.signOut();
  const { error: sign2Err } = await userClient.auth.signInWithPassword({ email, password });
  if (sign2Err) fail('re-login', sign2Err.message);

  const { data: loaded, error: loadErr } = await userClient
    .from('saves')
    .select('user_id, story_slug, scene_id, path, updated_at')
    .eq('user_id', userId)
    .eq('story_slug', STORY)
    .maybeSingle();
  if (loadErr) fail('load saves', loadErr.message);
  if (!loaded) fail('load saves', 'no row');
  if (loaded.scene_id !== MID_SCENE) fail('sceneId mismatch', loaded.scene_id);
  const pathOk =
    Array.isArray(loaded.path) &&
    loaded.path.length === MID_PATH.length &&
    loaded.path.every((id, i) => id === MID_PATH[i]);
  if (!pathOk) fail('path mismatch', JSON.stringify(loaded.path));

  console.log('  resume readback: ok');
  console.log('  sceneId:', loaded.scene_id);
  console.log('  path:', JSON.stringify(loaded.path));
  console.log('PROVE PASS: login → save mid-path → resume');
} finally {
  // Cleanup throwaway user (best-effort)
  try {
    await admin.from('saves').delete().eq('user_id', userId);
    await admin.auth.admin.deleteUser(userId);
    console.log('  cleanup: user deleted');
  } catch (e) {
    console.log('  cleanup: skipped', e?.message || '');
  }
}
