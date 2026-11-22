// One chest in progress (design §3, §4, §8): its dials, the cursor, the gold that stays
// latched, every try, and how often the lantern was used. Everything is saved, so a kid who
// leaves comes back to the same chest exactly as it was.

import { markTry, type Mark } from './marking.js';
import { KEYS, type Size } from './words.js';

export interface Chest {
  id: string;
  tries: string[];
  lantern: number;
  dials: string[];
  /** Latched gold positions: skipped by typing, kept between tries, freed by a tap. */
  gold: number[];
  cursor: number;
}

/** When the device draws no emoji, a Small chest latches its first letter instead (§9). */
export function newChest(id: string, latchFirst: boolean): Chest {
  const dials = [...id].map(() => '');
  if (!latchFirst) return { id, tries: [], lantern: 0, dials, gold: [], cursor: 0 };
  dials[0] = id[0]!;
  return { id, tries: [], lantern: 0, dials, gold: [0], cursor: 1 };
}

export const keysLeft = (chest: Chest, size: Size) => KEYS[size] - chest.tries.length;
export const isFull = (chest: Chest) => chest.dials.every(Boolean);
const isOpen = (chest: Chest, index: number) => !chest.gold.includes(index);

function unlatch(chest: Chest, index: number): void {
  chest.gold = chest.gold.filter((position) => position !== index);
}

/** The dial the next letter goes to: an empty open dial to the right, then any, else stay. */
function nextDial(chest: Chest, from: number): number {
  const empty = (index: number) => isOpen(chest, index) && !chest.dials[index];
  const order = [...chest.dials.keys()];
  return order.find((index) => index > from && empty(index)) ?? order.find(empty) ?? from;
}

export function typeLetter(chest: Chest, letter: string): void {
  unlatch(chest, chest.cursor);
  chest.dials[chest.cursor] = letter;
  chest.cursor = nextDial(chest, chest.cursor);
}

export function rubOut(chest: Chest): void {
  if (chest.dials[chest.cursor] && isOpen(chest, chest.cursor)) {
    chest.dials[chest.cursor] = '';
    return;
  }
  for (let index = chest.cursor - 1; index >= 0; index--) {
    if (isOpen(chest, index) && chest.dials[index]) {
      chest.dials[index] = '';
      chest.cursor = index;
      return;
    }
  }
}

export function moveCursor(chest: Chest, step: number): void {
  chest.cursor = Math.min(chest.dials.length - 1, Math.max(0, chest.cursor + step));
}

/** Roll a dial one letter through the alphabet, like turning a real lock ring. */
export function rollDial(chest: Chest, index: number, step: number, alphabet: string): void {
  unlatch(chest, index);
  const letters = [...alphabet];
  const at = letters.indexOf(chest.dials[index] ?? '');
  chest.dials[index] = letters[at < 0 ? (step > 0 ? 0 : letters.length - 1) : (at + step + letters.length) % letters.length]!;
  chest.cursor = index;
}

/** A tap: on gold it lets the letter go; anywhere it moves the cursor there. */
export function tapDial(chest: Chest, index: number): void {
  unlatch(chest, index);
  chest.cursor = index;
}

export interface TurnResult {
  guess: string;
  marks: Mark[];
  won: boolean;
  outOfKeys: boolean;
}

/** Turn the key: the try is marked, gold latches, every other dial clears for the next try. */
export function turnKey(chest: Chest, size: Size): TurnResult {
  const guess = chest.dials.join('');
  const marks = markTry(guess, chest.id);
  chest.tries.push(guess);
  chest.gold = marks.flatMap((mark, index) => (mark === 'gold' ? [index] : []));
  chest.dials = chest.dials.map((letter, index) => (marks[index] === 'gold' ? letter : ''));
  chest.cursor = nextDial(chest, -1);
  const won = marks.every((mark) => mark === 'gold');
  return { guess, marks, won, outOfKeys: !won && keysLeft(chest, size) <= 0 };
}

/**
 * The lantern (§8): first it lifts the cloth off a hidden picture, then each tap latches the
 * leftmost open dial gold, and it stops with one dial left, so the last letter is the kid's.
 */
export function lanternStep(chest: Chest, clothed: boolean): 'cloth' | 'latch' | null {
  const clothLifted = chest.lantern > 0;
  if (clothed && !clothLifted) {
    chest.lantern++;
    return 'cloth';
  }
  const open = chest.dials.flatMap((_, index) => (isOpen(chest, index) ? [index] : []));
  if (open.length <= 1) return null;
  const index = open[0]!;
  chest.dials[index] = chest.id[index]!;
  chest.gold.push(index);
  chest.lantern++;
  chest.cursor = nextDial(chest, index);
  return 'latch';
}
