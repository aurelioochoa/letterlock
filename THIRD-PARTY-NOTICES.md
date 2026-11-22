# Third-Party Notices for Letterlock

Letterlock's own code and its eight word lists are licensed under PolyForm Noncommercial 1.0.0
(see `LICENSE.md`). Every word list was written by hand for this game; none was downloaded or
generated. The dependencies below keep their own licenses.

## Runtime dependencies (shipped to players)

None. Everything in `dist/` is Letterlock's own code and data. The pictures are emoji drawn by
the player's own device fonts; no font or image ships with the game.

## Build / dev dependencies (not shipped to players)

- [TypeScript](https://www.typescriptlang.org/) 5.9.3 — Apache-2.0
- [Vite](https://vite.dev/) 8.2.2 — MIT (its CSS minifier, lightningcss, is MPL-2.0; a
  build tool only — nothing of it is in `dist/`)
- [Vitest](https://vitest.dev/) 4.1.11 — MIT
- [Playwright](https://playwright.dev/) 1.65.0 — Apache-2.0 (the smoke harness only)
- [@types/node](https://github.com/DefinitelyTyped/DefinitelyTyped) 24.10.1 — MIT (types only)

Run `npm run check:licenses` to re-verify that every installed dependency carries a
recognised free/open-source license, that every word list records its source, that the repo
holds no asset files, and that `dist/` contains no live external URL.
