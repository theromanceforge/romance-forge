/**
 * Non-blocking “Save your place” prompt hooks for guests.
 * Choosing / continuing always works even if the prompt is visible or dismissed.
 */

import { isGuest } from '../auth/session.js';
import { dismissSavePrompt, isSavePromptDismissed } from './store.js';

/**
 * @param {{
 *   session: import('../auth/session.js').AuthSession,
 *   alreadyShown: boolean,
 *   storage?: Storage
 * }} opts
 * @returns {boolean}
 */
export function shouldShowSavePrompt({ session, alreadyShown, storage }) {
  if (alreadyShown) return false;
  if (!isGuest(session)) return false;
  if (isSavePromptDismissed(storage)) return false;
  return true;
}

/**
 * @param {Storage} [storage]
 */
export function markSavePromptDismissed(storage) {
  dismissSavePrompt(storage);
}
