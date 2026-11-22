# Letterlock verification — 2026-11-22

Measured on this machine (Linux, Node 22.23.3, Playwright 1.65.0 Chromium, headless). Nothing
here was run on a physical phone or Chromebook. This machine has an emoji font but no CJK
fonts, so Korean and Chinese text shows as boxes in its screenshots; the smoke run checks
that text by content instead.

## Automated checks

- **`npm test`**: 4 files, 137 tests, ~4 s. Final line: `Tests  137 passed (137)`.
  - `src/sim/words.test.ts` (90): for each of the eight languages, re-derived from the raw
    lines: every answer normalises to a chest size and no two share a lock string; the counts
    below; every lock letter is in the alphabet and on both keyboards (the language's layout,
    with 2-beolsik's Shift layer, and A-B-C order); every answer is one word in its own script,
    no ß in German, Chinese pinyin carries only tone marks (no ü, no apostrophe), and every
    Korean word round-trips split → compose; **no answer is a blocked word in any of the eight
    languages** (the union blocklist, whole words on dial letters and real spelling, plus
    substrings of the strongest terms); every Small answer has its own picture and every
    picture is Emoji 11.0 or older; tier 1 has no repeated letter and at most two one-letter
    neighbours (at least 5 tier-1 answers per size); the two teaching chests come first, Small,
    tier 1; and **every chest is solvable from its clues within its keys** (a greedy minimax
    player that only knows the size's list pins down every answer from the marks alone).
    Plus: the picture table holds no people, skin tones, flags or joined sequences, and
    refuses known Emoji 12+ glyphs.
  - `src/sim/rules.test.ts` (23): marking with repeated letters (FROG against GOOF → blue,
    pewter, gold, blue; EEEE against TREE); each key keeps its best mark; the lantern's
    no-new-gold count; normalisation per language (Ñ kept in es, Ä in de, Å Æ in no, Ç and
    accents dropped, Œ → OE, tones dropped); Korean split and compose (과 → ㄱㅗㅏ, 닭, 달걀,
    의자, 앉아); keys by `event.key` and Korean by `event.code` with Shift, a dead key and ß
    ignored, a Cyrillic layout falling back to the physical key; both keyboards hold every
    letter exactly once, in all eight languages; gold latches and typing skips it; rub-out;
    tap to unlatch; dial rolling wraps; seven keys then the chest opens anyway; the lantern
    lifts the cloth, latches left to right, always leaves the last dial; tier up after three
    chests with two keys spare, down after a reveal or two last-key opens, a returning kid a
    notch down; the wiggle after five easy opens in a row; the basket returns a word after
    exactly 5–10 chests of its own language and size; teaching chests first, then the nearest
    tier, then a reshuffle that skips the basket.
  - `src/sim/save.test.ts` (6): the v1 fixture round-trips byte for byte; field-by-field
    fallback (bad chests, tries, gold, tier, settings); the shelf rescued from corrupt JSON; a
    newer save's fields and version kept; missing or throwing storage tolerated; one key; an
    opened chest shelved once with its own spelling, picture and pinyin, its ✦ kept.
  - `src/i18n/i18n.test.ts` (18): eight tables with identical keys and placeholders, none empty,
    none copied from English, the name never translated, blanking; `kidtopia:lang` first, then
    the browser (nb/nn → no), then English, with a throwing storage.
- **`npm run build`**: `tsc --noEmit`, the Vite build, then `scripts/check-licenses.mjs`: 49
  dependencies with free licenses; each of the eight word lists records its source
  (hand-written for Letterlock); zero asset files among 48 scanned; no live external URL in
  `dist/` (the one inert string is the inline favicon's SVG namespace). **146.2 KiB raw,
  42.5 KiB gzip** against the 2048 KiB budget (design: ≤ 2 MiB, expected ~0.8 MiB). Each list
  is its own lazy chunk of 9–16 KiB, so a session downloads one. Final line: `all gates passed`.
- **`npm run smoke`** (the real `dist/` under `vite preview`; fails on any console or page
  error, failed or external request):
  - Desktop 1280×720, **keys only**: a first visit opens straight on the FROG teaching chest
    with 🐸 in the window and no menu; FORG marks gold, blue, blue, gold, F and G stay latched,
    the keys keep their marks; RO + Enter opens it, FROG goes on the shelf with its ✦; Enter
    brings FISH; Tab walks lantern, set aside, the three sizes, shelf, sound; a letter returns
    focus to the lock; the lantern latches F; Esc pauses, arrows reach the A-B-C keyboard and
    Enter reorders the keys; a Medium chest starts under its cloth, runs out of keys, rolls
    the answer in gold and goes to the basket with a wait of 5–10, not onto the shelf; the
    shelf's number pad opens Medium № 42; mute saved; a reload boots into the same chest
    exactly as it was; six tries on a Small chest all stay on screen.
  - Phone 360×640 with **real touch taps** (CDP): letter keys ≥ 30 × 54 px, toolbar, lantern
    and set-aside ≥ 48 px, dials ≥ 56 px; FROG by taps; a tap on a gold dial unlatches it; a
    54 px touch drag rolls an empty dial two clicks to B; six tries all on screen; pause and
    shelf by tap; a landscape 740×360 capture with the tries beside the chest.
  - Korean by `event.code`: an IME's `Process` key on KeyS dials ㄴ, Shift+R dials ㄲ, the jamo
    compose to 나무 above the lock, and the reveal shows 나무.
  - Chinese: the pinyin dials are lowercase, XIGUA opens 西瓜 with xīguā.
  - The site's exact iframe sandbox (`allow-scripts allow-same-origin allow-popups allow-forms
    allow-modals`, `allow="fullscreen; autoplay; gamepad"`): keys reach the game and it saves.
  - `?blank=1`: a chest is played and paused with every label empty, every control keeping an
    icon, and no words on the pause card beyond the native language names.
  - A device with no colour emoji (canvas probe forced blank): the Small chest latches its
    first letter instead of relying on the picture.
  - Final line: `smoke: OK (screenshots in /tmp/letterlock-shots/)`.

## The word lists (§B)

Hand-written in this session, one line per answer; nothing was downloaded or generated (a
scratch formatter only turned my notes into one-line JSON). The union blocklist test caught two
real cross-language problems while writing, both removed: German *Pute* (turkey) is French
*pute*, and *coco* (coconut, es/pt/fr) dials the same letters as Portuguese *cocô*.

| Language | Small | Medium | Large | Total | Worst-case tries, greedy minimax (keys 7 / 6 / 6) |
|---|---|---|---|---|---|
| en | 67 | 178 | 137 | 382 | 4 / 4 / 3 |
| es | 56 | 166 | 113 | 335 | 4 / 4 / 3 |
| de | 56 | 170 | 117 | 343 | 4 / 4 / 4 |
| pt | 54 | 179 | 104 | 337 | 4 / 4 / 3 |
| fr | 45 | 152 | 109 | 306 | 3 / 4 / 3 |
| no | 71 | 165 | 102 | 338 | 4 / 4 / 3 |
| ko | 62 | 158 | 107 | 327 | 4 / 4 / 3 |
| zh | 70 | 179 | 100 | 349 | 4 / 3 / 4 |

Small = 4 dials (zh: 5 pinyin letters), Medium = 5 (zh 6), Large = 6 (zh 7); Korean counts jamo.

## Screenshots looked at, and what they changed

From `/tmp/letterlock-shots/`: `desktop-opening`, `desktop-marks`, `desktop-reveal`,
`desktop-out-of-keys`, `desktop-pause`, `desktop-shelf`, `phone-opening`, `phone-reveal`,
`phone-six-tries`, `phone-landscape` (and the earlier scratch captures). Fixes made from them:
the focus rectangle doubled the cursor dial's glow (removed; the glow marks focus); the lock's
padding left six dials under 56 px at 360 px (reduced); the big-screen breakpoint pushed six
tries off a 720 px-tall desktop (raised to 820 px); in landscape the tries hugged the bottom
edge (centred) and the wall window sat under the toolbar buttons (moved to the top centre); the
small window picture stayed visible after it hopped out (hidden); the key ring was too faint
(larger, darker); the ↷ button was 40 px tall (now 48); the shelf led with the number pad
(now the kid's picture dictionary comes first); chest № 1 was coral (now the design's
cornflower).

## Deliberate differences from the design

1. **Small lists hold 45–71 answers, not ≥ 120** (§5). Every Small answer must be picturable
   by an Emoji 11.0 glyph with one obvious name, and there are not 120 such four-letter
   everyday nouns in any of these languages (French has the fewest). Padding with pictures
   that name something else would break "the picture names the word". The test floor is 45;
   Medium (≥ 150) and Large (≥ 100) meet the design's targets in every language.
2. **No "Real words only" setting; tries are always lenient** (§8, §15.3). That setting needs a
   broad accepted-words list per language from a downloaded free-licensed source, which this
   build's brief rules out, and a list with gaps would tell a kid a real word is not one.
3. **The Chinese Large lock's 7 dials are 48 px wide at 360 px**, not ≥ 56 (§10); every other
   lock keeps ≥ 56 px dials on a 360 px phone. They stay 60 px tall.
4. **The save keys chests by words language, then size** (`chests[lang][S|M|L]`, §C had
   `chests: {S, M, L}`) so switching "Words in" never loses a chest in progress; it also keeps
   the chosen `size`, and `tier` per size with its counters.
5. **Restart is ↷ set aside** (contract: pause/mute/restart): a word chest has no state worth
   restarting, so the per-chest reset is the design's own no-cost set aside.
6. **An opened chest moves on by itself after 3.2 s** (any key, tap or ▶ sooner), as in §3's
   "the next chest slides in"; a chest that ran out of keys waits for the kid, since its word
   is the lesson.
7. **The sail shadow sweeps once as each chest arrives**, not continuously, so nothing animates
   while idle (§12).
8. **Unmarked dials are ivory cylinders on the brass lock**, so an unmarked dial can never be
   mistaken for a gold one.
9. **Native read of the lists (§15.5) is still open.** The lists were chosen by hand for
   common, concrete, kid-safe words and pass the eight-language blocklist union, but a native
   reader for each language (ko, zh, no first) should read them before release.
