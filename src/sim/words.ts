// The answer lists (design §5, §B). A line holds only what a person writes: the real spelling,
// a picture, a familiarity tag, pinyin for Chinese and the teaching flag. The lock string, the
// chest size, the chest number and the hidden tier are all derived here, from the lists.

import { lockOf, type Language } from './letters.js';

export type Size = 'S' | 'M' | 'L';
export type Tier = 1 | 2 | 3;
export const SIZES: Size[] = ['S', 'M', 'L'];
export const KEYS: Record<Size, number> = { S: 7, M: 6, L: 6 };

/** Dials per chest; pinyin runs one longer, because short pinyin nouns are scarce (§5). */
export const dialsFor = (language: Language, size: Size) => ({ S: 4, M: 5, L: 6 })[size] + (language === 'zh' ? 1 : 0);

export interface AnswerLine {
  w: string;
  fam: Tier;
  pic?: string;
  py?: string;
  teach?: boolean;
}

export interface Answer {
  /** The lock string, unique within a language, so a saved chest survives list reordering. */
  id: string;
  size: Size;
  /** The plate on the chest: its place among its size, in file order, so new words go last. */
  number: number;
  word: string;
  pinyin?: string;
  picture?: string;
  teach: boolean;
  tier: Tier;
}

export type WordList = Record<Size, Answer[]>;

/** A letter in fewer than this share of a language's answers counts as rare for the tier. */
const RARE_SHARE = 0.03;

export const hasRepeat = (lock: string) => new Set(lock).size < [...lock].length;

/** Answers of the same size one letter apart: the BAKE / CAKE / LAKE trap (§6d). */
export function neighbourCount(lock: string, locks: string[]): number {
  return locks.filter((other) => other.length === lock.length && [...other].filter((letter, index) => letter !== lock[index]).length === 1).length;
}

export function sizeOf(lock: string, language: Language): Size | undefined {
  return SIZES.find((size) => dialsFor(language, size) === [...lock].length);
}

export function buildList(language: Language, lines: AnswerLine[]): WordList {
  const sized = lines.flatMap((line) => {
    const lock = lockOf(line.w, language, line.py);
    const size = sizeOf(lock, language);
    return size ? [{ line, lock, size }] : [];
  });
  const share = new Map<string, number>();
  for (const { lock } of sized) for (const letter of new Set(lock)) share.set(letter, (share.get(letter) ?? 0) + 1 / sized.length);
  const list: WordList = { S: [], M: [], L: [] };
  for (const { line, lock, size } of sized) {
    const peers = sized.filter((other) => other.size === size).map((other) => other.lock);
    const bumps = Number(hasRepeat(lock)) + Number(neighbourCount(lock, peers) > 2) + Number([...lock].some((letter) => (share.get(letter) ?? 0) < RARE_SHARE));
    list[size].push({
      id: lock,
      size,
      number: list[size].length + 1,
      word: line.w,
      pinyin: line.py,
      picture: line.pic,
      teach: line.teach === true,
      tier: Math.min(3, line.fam + bumps) as Tier,
    });
  }
  return list;
}

/**
 * The next chest of a size. Unseen teaching chests come first; then an unseen answer whose
 * tier is nearest the kid's; once every answer has been seen, the list reshuffles, skipping
 * what is in the back-later basket or on the lock right now.
 */
export function drawAnswer(candidates: Answer[], level: number, seen: Set<string>, blocked: Set<string>, random: () => number): Answer {
  const teaching = candidates.find((answer) => answer.teach && !seen.has(answer.id));
  if (teaching) return teaching;
  const unseen = candidates.filter((answer) => !seen.has(answer.id));
  let pool = candidates.filter((answer) => !blocked.has(answer.id));
  if (unseen.length) {
    const nearest = Math.min(...unseen.map((answer) => Math.abs(answer.tier - level)));
    pool = unseen.filter((answer) => Math.abs(answer.tier - level) === nearest);
  }
  const from = pool.length ? pool : candidates;
  return from[Math.floor(random() * from.length)]!;
}
