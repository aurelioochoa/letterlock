// words.test.ts trusts nothing (design §B): every guarantee the game makes about its lists is
// re-derived here from the raw lines, per language. A bad word fails `npm test`, never a kid.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BLOCKED_INSIDE, BLOCKED_WORDS } from '../data/blocklist.js';
import { PICTURES } from '../data/pictures.js';
import { ALPHABETS, KOREAN_SHIFT, LANGUAGES, composeHangul, keyboardRows, lockOf, normaliseLatin, splitHangul, type Language } from './letters.js';
import { markTry } from './marking.js';
import { KEYS, SIZES, buildList, dialsFor, type AnswerLine, type Size } from './words.js';

const lines = (language: Language): AnswerLine[] => JSON.parse(readFileSync(new URL(`../data/words/${language}/answers.json`, import.meta.url), 'utf8'));

/** The design's §5 table, as shipped: Small is capped by how many four-letter nouns an Emoji 11.0 picture can name. */
const MINIMUM: Record<Size, number> = { S: 45, M: 150, L: 100 };

/** Blocklist terms in the two forms an answer is compared in: dial letters and real spelling. */
const blockedForms = (term: string) => [term.toLowerCase(), normaliseLatin(term, 'en')];
const blockedWords = new Set(BLOCKED_WORDS.flatMap(blockedForms));
const blockedInside = BLOCKED_INSIDE.flatMap(blockedForms);

/**
 * The worst number of tries a greedy minimax player needs to pin down any answer of a list from
 * the marks alone, guessing only words from the list. If it fits the keys, every chest is
 * solvable from its clues: the lock always says enough.
 */
function worstTries(candidates: string[], guesses: string[]): number {
  if (candidates.length === 1) return 1;
  let best: Map<string, string[]> | null = null;
  let bestScore = Infinity;
  for (const guess of guesses) {
    const groups = new Map<string, string[]>();
    for (const answer of candidates) {
      const pattern = markTry(guess, answer).join();
      groups.set(pattern, [...(groups.get(pattern) ?? []), answer]);
    }
    const score = Math.max(...[...groups.values()].map((group) => group.length)) * 2 - Number(candidates.includes(guess));
    if (score < bestScore) {
      bestScore = score;
      best = groups;
    }
  }
  const solved = (pattern: string) => pattern.split(',').every((mark) => mark === 'gold');
  return 1 + Math.max(0, ...[...best!].filter(([pattern]) => !solved(pattern)).map(([, group]) => worstTries(group, guesses)));
}

describe.each(LANGUAGES)('the %s answer list', (language) => {
  const raw = lines(language);
  const list = buildList(language, raw);
  const answers = SIZES.flatMap((size) => list[size]);

  it('normalises every line to a chest size, with no duplicate lock strings', () => {
    expect(answers.length).toBe(raw.length);
    expect(new Set(answers.map((answer) => answer.id)).size).toBe(answers.length);
    for (const size of SIZES) for (const answer of list[size]) expect([...answer.id].length).toBe(dialsFor(language, size));
  });

  it('meets the shipped counts per size', () => {
    for (const size of SIZES) expect(list[size].length, size).toBeGreaterThanOrEqual(MINIMUM[size]);
  });

  it('puts every lock letter in the alphabet and on both keyboards', () => {
    const shifted = language === 'ko' ? Object.values(KOREAN_SHIFT).join('') : '';
    for (const alphabetOrder of [false, true]) {
      const keys = keyboardRows(language, alphabetOrder).join('') + (alphabetOrder ? '' : shifted);
      for (const answer of answers) for (const letter of answer.id) {
        expect(ALPHABETS[language], answer.word).toContain(letter);
        expect(keys, answer.word).toContain(letter);
      }
    }
  });

  it('spells every answer as one real word', () => {
    for (const { w, py } of raw) {
      expect(w, w).toMatch(language === 'zh' ? /^\p{Script=Han}+$/u : language === 'ko' ? /^\p{Script=Hangul}+$/u : /^\p{Script=Latin}+$/u);
      if (language === 'de') expect(w, w).not.toContain('ß');
      if (language === 'zh') expect(py, w).toMatch(/^[a-zāáǎàēéěèīíǐìōóǒòūúǔù]+$/);
      if (language === 'ko') expect(composeHangul(splitHangul(w)), w).toBe(w);
    }
  });

  it('never shows a word that is rude, scary or loaded in any of the eight languages', () => {
    for (const answer of answers) {
      const forms = [answer.word.toLowerCase(), answer.id, normaliseLatin(answer.word, 'en')];
      for (const form of forms) {
        expect(blockedWords.has(form), `${answer.word} is blocked`).toBe(false);
        for (const term of blockedInside) expect(form.includes(term), `${answer.word} contains ${term}`).toBe(false);
      }
    }
  });

  it('gives every Small answer its own picture, and every picture is Emoji 11.0 or older', () => {
    const small = list.S.map((answer) => answer.picture);
    expect(small.every(Boolean)).toBe(true);
    expect(new Set(small).size).toBe(small.length);
    for (const answer of answers) if (answer.picture) expect(PICTURES.get(answer.picture), `${answer.word} ${answer.picture}`).toBeLessThanOrEqual(11);
  });

  it('keeps tier 1 free of repeated letters and of more than two one-letter neighbours', () => {
    for (const size of SIZES) {
      const locks = list[size].map((answer) => answer.id);
      const tierOne = list[size].filter((answer) => answer.tier === 1);
      expect(tierOne.length, size).toBeGreaterThanOrEqual(5);
      for (const answer of tierOne) {
        expect(new Set(answer.id).size, answer.word).toBe(answer.id.length);
        const neighbours = locks.filter((other) => [...other].filter((letter, index) => letter !== answer.id[index]).length === 1);
        expect(neighbours.length, answer.word).toBeLessThanOrEqual(2);
      }
    }
  });

  it('opens on two teaching chests: Small, tier 1, listed first', () => {
    const teaching = raw.filter((line) => line.teach);
    expect(teaching).toEqual(raw.slice(0, 2));
    for (const line of teaching) {
      const answer = list.S.find((candidate) => candidate.id === lockOf(line.w, language, line.py));
      expect(answer?.tier, line.w).toBe(1);
    }
  });

  it.each(SIZES)('solves every %s chest from its clues within its keys', (size) => {
    const locks = list[size].map((answer) => answer.id);
    expect(worstTries(locks, locks)).toBeLessThanOrEqual(KEYS[size]);
  });
});

describe('the pictures', () => {
  it('hold no people, skin tones, flags or joined sequences', () => {
    for (const glyph of PICTURES.keys()) {
      expect(glyph).not.toMatch(/[\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}‍\u{E0020}-\u{E007F}]/u);
      expect(glyph).not.toMatch(/[\u{1F466}-\u{1F487}\u{1F574}-\u{1F57A}\u{1F645}-\u{1F64F}\u{1F926}-\u{1F93E}\u{1F9D1}-\u{1F9DD}]/u);
    }
  });

  it('refuse glyphs newer than Emoji 11.0', () => {
    for (const newer of ['🪁', '🦩', '🧄', '🪑', '🫐', '🪨', '🛝', '🫏']) expect(PICTURES.has(newer)).toBe(false);
  });
});
