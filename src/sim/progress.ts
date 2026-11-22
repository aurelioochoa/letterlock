// The silent difficulty and the back-later basket (design §6c, §6d). Nothing here is ever
// shown as a number: the tier only chooses which answer comes next, and the basket only
// chooses when a revealed word returns. Both count chests, never days.

import type { Language } from './letters.js';
import type { Size } from './words.js';

export interface TierRecord {
  level: number;
  /** Chests in a row opened with two keys to spare. */
  streak: number;
  /** Chests opened on the last key. */
  slips: number;
  /** Chests in a row opened with half the keys to spare: five wiggle the next size's icon. */
  easy: number;
}

export const freshTier = (): TierRecord => ({ level: 1, streak: 0, slips: 0, easy: 0 });

/** A returning kid starts a notch down. */
export const returningTier = (record: TierRecord): TierRecord => ({ ...record, level: Math.max(1, record.level - 1) });

export function afterChest(record: TierRecord, opened: boolean, spare: number, keys: number): { record: TierRecord; offer: boolean } {
  const next = { ...record };
  if (!opened) {
    next.level = Math.max(1, next.level - 1);
    next.streak = next.slips = next.easy = 0;
    return { record: next, offer: false };
  }
  next.streak = spare >= 2 ? next.streak + 1 : 0;
  if (next.streak === 3) {
    next.level = Math.min(3, next.level + 1);
    next.streak = 0;
  }
  if (spare === 0 && ++next.slips === 2) {
    next.level = Math.max(1, next.level - 1);
    next.slips = 0;
  }
  next.easy = spare * 2 >= keys ? next.easy + 1 : 0;
  const offer = next.easy === 5;
  if (offer) next.easy = 0;
  return { record: next, offer };
}

export interface LaterEntry {
  language: Language;
  size: Size;
  id: string;
  /** Chests of this language and size still to finish before it returns. */
  wait: number;
}

export function sendLater(later: LaterEntry[], language: Language, size: Size, id: string, random: () => number): LaterEntry[] {
  return [...later.filter((entry) => entry.id !== id || entry.language !== language), { language, size, id, wait: 5 + Math.floor(random() * 6) }];
}

/** One chest of this language and size has finished: everything waiting there comes a chest closer. */
export const tickLater = (later: LaterEntry[], language: Language, size: Size) =>
  later.map((entry) => (entry.language === language && entry.size === size ? { ...entry, wait: Math.max(0, entry.wait - 1) } : entry));

export const dueLater = (later: LaterEntry[], language: Language, size: Size) => later.find((entry) => entry.language === language && entry.size === size && entry.wait === 0);
