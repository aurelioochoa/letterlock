import { afterEach, describe, expect, it, vi } from 'vitest';
import { en } from './en.js';
import { TABLES, detectLanguage, setBlank, setLanguage, translate } from './index.js';
import { LANGUAGES } from '../sim/letters.js';

const holes = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe('string tables (§11)', () => {
  it.each(LANGUAGES)('%s has exactly the English keys, each non-empty, with the same placeholders', (language) => {
    const table = TABLES[language];
    expect(Object.keys(table).sort()).toEqual(Object.keys(en).sort());
    for (const [key, value] of Object.entries(table)) {
      expect(value.trim(), `${language}.${key}`).not.toBe('');
      expect(holes(value), `${language}.${key}`).toEqual(holes(en[key as keyof typeof en]));
    }
  });

  it.each(LANGUAGES.filter((language) => language !== 'en'))('%s is translated, not copied from English', (language) => {
    // A single word may match ("Pause"); sentences must not.
    const copied = Object.entries(TABLES[language]).filter(([key, value]) => value === en[key as keyof typeof en] && !/^[A-Z][a-z]+$/.test(value));
    expect(copied.map(([key]) => key)).toEqual([]);
  });

  it('never translates the name', () => {
    for (const language of LANGUAGES) expect(TABLES[language]['aria.game']).toContain('Letterlock');
  });

  it('fills placeholders and can blank every string', () => {
    setLanguage('de');
    expect(translate('aria.size', { count: 5 })).toBe('Truhe mit 5 Rädern');
    setBlank(true);
    expect(translate('pause.title')).toBe('');
    setBlank(false);
    setLanguage('en');
  });
});

describe('language detection', () => {
  afterEach(() => vi.unstubAllGlobals());

  const stub = (stored: string | null, browser: string[], throws = false) => {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => {
        if (throws) throw new Error('sandboxed');
        return key === 'kidtopia:lang' ? stored : null;
      },
    });
    vi.stubGlobal('navigator', { languages: browser, language: browser[0] });
  };

  it("reads the site's kidtopia:lang first, then the browser (nb and nn are Norwegian), then English", () => {
    stub('ko', ['fr-FR']);
    expect(detectLanguage()).toBe('ko');
    stub(null, ['nb-NO', 'en']);
    expect(detectLanguage()).toBe('no');
    stub('xx', ['ja', 'pt-BR']);
    expect(detectLanguage()).toBe('pt');
    stub(null, ['ja-JP']);
    expect(detectLanguage()).toBe('en');
    stub('es', ['zh-CN'], true);
    expect(detectLanguage()).toBe('zh');
  });
});
