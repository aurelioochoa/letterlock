// The save (design §C): one versioned key, `letterlock:save`, read field by field so anything
// broken falls back on its own. Shelf entries carry their own spelling and picture, so a word
// later removed from a list never leaves a kid's shelf. Corrupt JSON still gives up its shelf;
// a save from a newer version keeps the fields this one does not know; storage that is missing
// or throws just means no memory.

import type { Chest } from './chest.js';
import { LANGUAGES, type Language } from './letters.js';
import { freshTier, type LaterEntry, type TierRecord } from './progress.js';
import { SIZES, type Answer, type Size } from './words.js';

export const SAVE_KEY = 'letterlock:save';
export const SAVE_VERSION = 1;

export interface ShelfEntry {
  id: string;
  w: string;
  pic?: string;
  py?: string;
  /** Opened without the lantern: the ✦ beside it. */
  star: boolean;
}

export interface Settings {
  muted: boolean;
  /** null follows the system's prefers-reduced-motion (§D). */
  reducedMotion: boolean | null;
  /** A-B-C order instead of the language's own keyboard layout (§10). */
  abc: boolean;
  /** Lowercase dials for early readers taught lowercase first (§D). */
  lowercase: boolean;
}

export interface Save {
  /** The "Words in" language; null follows the UI language (§11). */
  words: Language | null;
  size: Size;
  /** The chest in progress, per words language and size: quitting loses nothing. */
  chests: Partial<Record<Language, Partial<Record<Size, Chest>>>>;
  shelf: Partial<Record<Language, ShelfEntry[]>>;
  later: LaterEntry[];
  tier: Record<Size, TierRecord>;
  settings: Settings;
}

export interface Loaded {
  save: Save;
  /** Fields this version does not know, kept so writing never destroys a newer save. */
  extras: Record<string, unknown>;
  version: number;
  /** A save was found: a returning kid starts a notch down (§6d). */
  returning: boolean;
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;
type Fields = Record<string, unknown>;

export function freshSave(): Save {
  return {
    words: null,
    size: 'S',
    chests: {},
    shelf: {},
    later: [],
    tier: { S: freshTier(), M: freshTier(), L: freshTier() },
    settings: { muted: false, reducedMotion: null, abc: false, lowercase: false },
  };
}

const isLanguage = (value: unknown): value is Language => LANGUAGES.includes(value as Language);
const isSize = (value: unknown): value is Size => SIZES.includes(value as Size);
const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;
const record = (value: unknown): Fields => (typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Fields) : {});
const flag = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
const text = (value: unknown) => (typeof value === 'string' && value.length > 0 && value.length < 40 ? value : undefined);

function parseChest(value: unknown): Chest | null {
  const fields = record(value);
  const id = text(fields.id);
  if (!id) return null;
  const length = id.length;
  const dials = Array.isArray(fields.dials) && fields.dials.length === length && fields.dials.every((letter) => letter === '' || (typeof letter === 'string' && letter.length === 1)) ? (fields.dials as string[]) : Array.from({ length }, () => '');
  const tries = Array.isArray(fields.tries) ? fields.tries.filter((guess): guess is string => typeof guess === 'string' && guess.length === length) : [];
  const gold = Array.isArray(fields.gold) ? [...new Set(fields.gold.filter((index): index is number => isCount(index) && index < length && dials[index] === id[index]))] : [];
  return { id, tries, lantern: isCount(fields.lantern) ? fields.lantern : 0, dials, gold, cursor: isCount(fields.cursor) && fields.cursor < length ? fields.cursor : 0 };
}

function parseShelfEntry(value: unknown): ShelfEntry | null {
  const fields = record(value);
  const id = text(fields.id);
  const w = text(fields.w);
  if (!id || !w) return null;
  return { id, w, ...(text(fields.pic) && { pic: text(fields.pic) }), ...(text(fields.py) && { py: text(fields.py) }), star: flag(fields.star, false) };
}

function parseTier(value: unknown): TierRecord {
  const fields = record(value);
  const level = fields.level;
  return {
    level: level === 1 || level === 2 || level === 3 ? level : 1,
    streak: isCount(fields.streak) ? fields.streak : 0,
    slips: isCount(fields.slips) ? fields.slips : 0,
    easy: isCount(fields.easy) ? fields.easy : 0,
  };
}

/** Corrupt JSON: rescue every legible shelf entry under the language key written before it. */
function rescueShelf(raw: string): Save['shelf'] {
  const shelf: Save['shelf'] = {};
  let language: Language | null = null;
  for (const match of raw.matchAll(/"(en|es|de|pt|fr|no|ko|zh)":\[|(\{"id":"[^"{}]*"[^{}]*\})/g)) {
    if (match[1]) language = match[1] as Language;
    else if (language) {
      try {
        const entry = parseShelfEntry(JSON.parse(match[2]!));
        if (entry) (shelf[language] ??= []).push(entry);
      } catch {
        // A torn entry is lost on its own; the rest of the shelf survives.
      }
    }
  }
  return shelf;
}

export function parseSave(raw: string | null): Loaded {
  const save = freshSave();
  const loaded: Loaded = { save, extras: {}, version: SAVE_VERSION, returning: raw !== null };
  if (!raw) return loaded;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    save.shelf = rescueShelf(raw);
    return loaded;
  }
  const fields = record(data);
  save.words = isLanguage(fields.words) ? fields.words : null;
  save.size = isSize(fields.size) ? fields.size : 'S';
  for (const [language, sizes] of Object.entries(record(fields.chests))) {
    if (!isLanguage(language)) continue;
    for (const [size, value] of Object.entries(record(sizes))) {
      const chest = parseChest(value);
      if (isSize(size) && chest) (save.chests[language] ??= {})[size] = chest;
    }
  }
  for (const [language, entries] of Object.entries(record(fields.shelf))) {
    if (isLanguage(language) && Array.isArray(entries)) save.shelf[language] = entries.map(parseShelfEntry).filter((entry): entry is ShelfEntry => entry !== null);
  }
  save.later = (Array.isArray(fields.later) ? fields.later : []).flatMap((value) => {
    const entry = record(value);
    const id = text(entry.id);
    return isLanguage(entry.language) && isSize(entry.size) && id && isCount(entry.wait) ? [{ language: entry.language, size: entry.size, id, wait: entry.wait }] : [];
  });
  const tier = record(fields.tier);
  save.tier = { S: parseTier(tier.S), M: parseTier(tier.M), L: parseTier(tier.L) };
  const settings = record(fields.settings);
  save.settings = {
    muted: flag(settings.muted, false),
    reducedMotion: typeof settings.reducedMotion === 'boolean' ? settings.reducedMotion : null,
    abc: flag(settings.abc, false),
    lowercase: flag(settings.lowercase, false),
  };
  const known = new Set([...Object.keys(save), 'v']);
  loaded.extras = Object.fromEntries(Object.entries(fields).filter(([key]) => !known.has(key)));
  loaded.version = typeof fields.v === 'number' && fields.v > SAVE_VERSION ? fields.v : SAVE_VERSION;
  return loaded;
}

export const serializeSave = (loaded: Loaded) => JSON.stringify({ ...loaded.extras, v: loaded.version, ...loaded.save });

function storage(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadSave(store: Store | null = storage()): Loaded {
  try {
    return parseSave(store?.getItem(SAVE_KEY) ?? null);
  } catch {
    return parseSave(null);
  }
}

export function writeSave(loaded: Loaded, store: Store | null = storage()): void {
  try {
    store?.setItem(SAVE_KEY, serializeSave(loaded));
  } catch {
    // Quota or a sandbox: the game plays on without remembering.
  }
}

/** An opened chest goes on the shelf once; opening it again lantern-free still earns its ✦. */
export function shelve(save: Save, language: Language, answer: Answer, star: boolean): void {
  const shelf = (save.shelf[language] ??= []);
  const existing = shelf.find((entry) => entry.id === answer.id);
  if (existing) existing.star ||= star;
  else shelf.push({ id: answer.id, w: answer.word, ...(answer.picture && { pic: answer.picture }), ...(answer.pinyin && { py: answer.pinyin }), star });
}
