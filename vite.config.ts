import { defineConfig } from 'vite';

// base: './' is load-bearing: the bundle runs unmodified under /g/letterlock/ on the site and
// at the root in dev (design §12).
export default defineConfig({
  base: './',
  server: { port: 5196, host: '127.0.0.1' },
  preview: { port: 4196 },
  build: { target: 'es2022' },
});
