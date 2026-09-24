/**
 * SaveStore — load/save SaveRecord.
 * Local: localStorage. Cloud: stub seam until Master signs a vendor.
 */

import { isValidSaveRecord } from './record.js';

const KEY_PREFIX = 'romanceForge.save.';

/**
 * @typedef {{
 *   load: (userId: string, storySlug: string) => (import('./record.js').SaveRecord | null) | Promise<import('./record.js').SaveRecord | null>,
 *   save: (record: import('./record.js').SaveRecord) => void | Promise<void>,
 *   clear?: (userId: string, storySlug: string) => void | Promise<void>
 * }} SaveStore
 */

/**
 * @param {string} userId
 * @param {string} storySlug
 * @returns {string}
 */
export function saveStorageKey(userId, storySlug) {
  return `${KEY_PREFIX}${userId}.${storySlug}`;
}

/**
 * @param {Storage} [storage]
 * @returns {SaveStore}
 */
export function createLocalSaveStore(storage) {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);

  return {
    load(userId, storySlug) {
      if (!store) return null;
      try {
        const raw = store.getItem(saveStorageKey(userId, storySlug));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return isValidSaveRecord(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },
    save(record) {
      if (!isValidSaveRecord(record)) {
        throw new Error('Invalid SaveRecord');
      }
      if (!store) return;
      try {
        store.setItem(
          saveStorageKey(record.userId, record.storySlug),
          JSON.stringify(record)
        );
      } catch {
        /* quota / private mode — ignore */
      }
    },
    clear(userId, storySlug) {
      if (!store) return;
      try {
        store.removeItem(saveStorageKey(userId, storySlug));
      } catch {
        /* ignore */
      }
    },
  };
}

/**
 * Cloud adapter shape. Does not hit the network.
 * TODO: implement after Master signs vendor (Supabase recommended).
 * @returns {SaveStore}
 */
export function createCloudSaveStoreStub() {
  return {
    async load(_userId, _storySlug) {
      return null;
    },
    async save(_record) {
      throw new Error('CloudSaveStore not configured — awaiting Master vendor sign-off');
    },
    async clear(_userId, _storySlug) {
      /* no-op stub */
    },
  };
}

const PROMPT_DISMISS_KEY = 'romanceForge.savePromptDismissed';

/** @param {Storage} [storage] */
export function isSavePromptDismissed(storage) {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return false;
  try {
    return store.getItem(PROMPT_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/** @param {Storage} [storage] */
export function dismissSavePrompt(storage) {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return;
  try {
    store.setItem(PROMPT_DISMISS_KEY, '1');
  } catch {
    /* ignore */
  }
}

/**
 * In-memory SaveStore for tests / mock cloud demos (no network).
 * @returns {SaveStore & { _dump: () => Map<string, import('./record.js').SaveRecord> }}
 */
export function createInMemorySaveStore() {
  /** @type {Map<string, import('./record.js').SaveRecord>} */
  const map = new Map();

  return {
    load(userId, storySlug) {
      return map.get(saveStorageKey(userId, storySlug)) ?? null;
    },
    save(record) {
      if (!isValidSaveRecord(record)) {
        throw new Error('Invalid SaveRecord');
      }
      map.set(saveStorageKey(record.userId, record.storySlug), {
        ...record,
        path: [...record.path],
      });
    },
    clear(userId, storySlug) {
      map.delete(saveStorageKey(userId, storySlug));
    },
    _dump() {
      return map;
    },
  };
}

export { createSupabaseSaveStore, rowToSaveRecord, saveRecordToRow } from './supabaseStore.js';
