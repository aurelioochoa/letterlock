# Letterlock

Every chest in the windmill loft is shut with a padlock of letter dials. Dial in a word and
turn the key: a letter in the right place turns gold and latches, one that belongs elsewhere
shuffles side to side, one not in the word goes dull pewter. When every dial is gold the lid
pops and out hops the thing the word names, onto your shelf. Out of keys? The chest opens
anyway to show the word, and comes back a few chests later. A word game in the line of Jotto
(1955) and Mastermind, for kids, in eight languages. A first-party game for
[kidtopiaplay.com](https://kidtopiaplay.com).

TypeScript + Vite, no framework and no runtime dependencies. Zero asset files: the loft and
chests are CSS gradients, every icon an inline SVG, every picture the device's own emoji, every
sound synthesized with Web Audio. No network, no accounts; progress lives in `localStorage`
under `letterlock:save`. Eight languages (en, es, de, pt, fr, no, ko, zh) for the screen and
for the words: Korean locks take jamo on a 2-beolsik keyboard, Chinese locks take toneless
pinyin with the characters and tones on the reveal. The language follows the site's
`kidtopia:lang`, then the browser; a "Words in" setting opens chests from any of the lists.

## Commands

```bash
npm ci
npm run dev      # dev server at localhost:5196
npm test         # Vitest: every word list's guarantees, marking, Korean, tier, basket, save, strings
npm run build    # tsc --noEmit + production build + license/word-source/asset/network/byte gates
npm run smoke    # after a build: plays the real dist/ in headless Chromium by keys and by touch,
                 # inside the site's iframe sandbox; SHOTS=<dir> for screenshots
```

Controls: letters dial a letter · Enter turns the key · Backspace rubs out · ← → choose a
dial · ↑ ↓ roll a dial · Tab walks the lantern, set aside, sizes, shelf, sound and pause ·
Esc pauses. Touch: tap the keys, tap a dial to move there or to let a gold one go, drag a dial
to roll it.

## The word lists

`src/data/words/<lang>/answers.json`, one hand-written line per answer:
`{"w": "Frosch", "pic": "🐸", "fam": 1}` (real spelling, an Emoji 11.0 picture, familiarity 1–3;
Chinese adds `"py"`, the two teaching chests carry `"teach": true`). The lock string, chest size,
chest number and hidden tier are derived. New words go at the end of a file, so chest numbers
never move. `src/sim/words.test.ts` re-proves every guarantee on every run, including that each
chest can be solved from its marks within its keys.

See [VERIFICATION.md](./VERIFICATION.md) for the checks, measurements and the deliberate
differences from the design.

## License

[PolyForm Noncommercial 1.0.0](./LICENSE.md); commercial use needs a separate license, see
[COMMERCIAL-LICENSE.md](./COMMERCIAL-LICENSE.md). Dependencies keep their own licenses:
[THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
