// Strings (§11). The language comes from the SITE's own key, read-only (`kidtopia:lang` is a
// contract with kidtopiaplay.com and this game never writes it), then the browser, then
// English. The words on the lock follow it unless the "Words in" setting says otherwise.

import { LANGUAGES, type Language } from '../sim/letters.js';
import { de } from './de.js';
import { en, type StringKey, type Table } from './en.js';
import { es } from './es.js';
import { fr } from './fr.js';
import { ko } from './ko.js';
import { no } from './no.js';
import { pt } from './pt.js';
import { zh } from './zh.js';

export type { StringKey };
export const TABLES: Record<Language, Table> = { en, es, de, pt, fr, no, ko, zh };
const SITE_LANGUAGE_KEY = 'kidtopia:lang';

let current: Language = 'en';
let blank = false;

function known(code: string | null | undefined): Language | null {
  const base = (code ?? '').toLowerCase().split(/[-_]/)[0] ?? '';
  // Norwegian arrives as nb or nn as often as no.
  const mapped = base === 'nb' || base === 'nn' ? 'no' : base;
  return LANGUAGES.includes(mapped as Language) ? (mapped as Language) : null;
}

export function detectLanguage(): Language {
  try {
    const stored = known(localStorage.getItem(SITE_LANGUAGE_KEY));
    if (stored) return stored;
  } catch {
    // A sandboxed frame can throw on storage; the browser's preference still works.
  }
  try {
    for (const code of navigator.languages?.length ? navigator.languages : [navigator.language]) {
      const language = known(code);
      if (language) return language;
    }
  } catch {
    // No navigator: English.
  }
  return 'en';
}

export function setLanguage(language: Language): void {
  current = language;
}

export const getLanguage = () => current;

/** `?blank=1`: every string empty, to prove the game plays with no words (§11). */
export function setBlank(on: boolean): void {
  blank = on;
}

export function translate(key: StringKey, params?: Record<string, string | number>): string {
  if (blank) return '';
  const value = TABLES[current][key];
  return params ? value.replace(/\{(\w+)\}/g, (hole, name: string) => String(params[name] ?? hole)) : value;
}
