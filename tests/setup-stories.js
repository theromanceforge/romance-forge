// Vitest setup: the app lazy-loads each story chunk; tests drive the reader
// synchronously, so preload every story into the shared lazy cache first.
import { preloadAllStories } from '../src/stories/lazy.js';

await preloadAllStories();
