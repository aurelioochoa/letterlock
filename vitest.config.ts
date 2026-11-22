import { defineConfig } from 'vitest/config';

// src/sim/ imports no DOM, so the word lists and rules are tested headless in Node (design §B).
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
