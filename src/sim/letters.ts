// What a lock's dials can hold, per language (design §11), and how a real spelling becomes
// dial letters. Protected letters are kept before NFD runs, because NFD would split Ñ, Ä, Ö,
// Ü and Å and the mark strip would then delete their marks. Korean splits syllables into the
// keys a 2-beolsik typist presses, by syllable arithmetic; Chinese locks take toneless pinyin.

export type Language = 'en' | 'es' | 'de' | 'pt' | 'fr' | 'no' | 'ko' | 'zh';
export const LANGUAGES: Language[] = ['en', 'es', 'de', 'pt', 'fr', 'no', 'ko', 'zh'];

/** Native names: the "Words in" list shows these in every UI language, never translated. */
export const NATIVE_NAMES: Record<Language, string> = {
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  pt: 'Português',
  fr: 'Français',
  no: 'Norsk',
  ko: '한국어',
  zh: '中文',
};

const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PROTECTED: Partial<Record<Language, string>> = { es: 'Ñ', de: 'ÄÖÜ', no: 'ÆØÅ' };

const LEADS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const VOWELS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const TAILS = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
/** Compound vowels and final clusters are two key presses on 2-beolsik. */
const PAIRS: Record<string, string> = {
  ㅘ: 'ㅗㅏ', ㅙ: 'ㅗㅐ', ㅚ: 'ㅗㅣ', ㅝ: 'ㅜㅓ', ㅞ: 'ㅜㅔ', ㅟ: 'ㅜㅣ', ㅢ: 'ㅡㅣ',
  ㄳ: 'ㄱㅅ', ㄵ: 'ㄴㅈ', ㄶ: 'ㄴㅎ', ㄺ: 'ㄹㄱ', ㄻ: 'ㄹㅁ', ㄼ: 'ㄹㅂ', ㄽ: 'ㄹㅅ', ㄾ: 'ㄹㅌ', ㄿ: 'ㄹㅍ', ㅀ: 'ㄹㅎ', ㅄ: 'ㅂㅅ',
};
const JOINED = Object.fromEntries(Object.entries(PAIRS).map(([whole, parts]) => [parts, whole]));
const KOREAN_KEYS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎㅏㅐㅑㅒㅓㅔㅕㅖㅗㅛㅜㅠㅡㅣ';
const KOREAN_VOWEL_KEYS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅛㅜㅠㅡㅣ';

export const ALPHABETS: Record<Language, string> = {
  en: LATIN,
  es: LATIN.replace('N', 'NÑ'),
  de: LATIN + 'ÄÖÜ',
  pt: LATIN,
  fr: LATIN,
  no: LATIN + 'ÆØÅ',
  ko: KOREAN_KEYS,
  zh: LATIN,
};

const QWERTY = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const LAYOUTS: Record<Language, string[]> = {
  en: QWERTY,
  pt: QWERTY,
  zh: QWERTY,
  es: ['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM'],
  de: ['QWERTZUIOPÜ', 'ASDFGHJKLÖÄ', 'YXCVBNM'],
  no: ['QWERTYUIOPÅ', 'ASDFGHJKLØÆ', 'ZXCVBNM'],
  fr: ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'],
  ko: ['ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔ', 'ㅁㄴㅇㄹㅎㅗㅓㅏㅣ', 'ㅋㅌㅊㅍㅠㅜㅡ'],
};
/** 2-beolsik's Shift layer: the five tense consonants and the two ye vowels. */
export const KOREAN_SHIFT: Record<string, string> = { ㅂ: 'ㅃ', ㅈ: 'ㅉ', ㄷ: 'ㄸ', ㄱ: 'ㄲ', ㅅ: 'ㅆ', ㅐ: 'ㅒ', ㅔ: 'ㅖ' };
// A Hangul IME rewrites event.key, so Korean reads the physical key (design §10).
const KOREAN_BY_CODE = Object.fromEntries(QWERTY.flatMap((row, rowIndex) => [...row].map((letter, column) => [`Key${letter}`, LAYOUTS.ko[rowIndex]![column]!])));

/** The on-screen keyboard rows, in the language's own layout or in alphabet order. */
export function keyboardRows(language: Language, alphabetOrder: boolean): string[] {
  if (!alphabetOrder) return LAYOUTS[language];
  // The last row is three key-widths shorter, because the key button and ⌫ share it.
  const letters = ALPHABETS[language];
  const perRow = Math.ceil((letters.length + 3) / 3);
  return [letters.slice(0, perRow), letters.slice(perRow, perRow * 2), letters.slice(perRow * 2)];
}

/** A Latin word in its lock form: capitals, protected letters kept, other marks dropped, Œ → OE. */
export function normaliseLatin(word: string, language: Language): string {
  const keep = PROTECTED[language] ?? '';
  return [...word.toUpperCase()]
    .map((letter) => (keep.includes(letter) ? letter : letter.normalize('NFD').replace(/\p{M}/gu, '')))
    .join('')
    .replace(/Œ/g, 'OE')
    .replace(language === 'no' ? /$^/ : /Æ/g, 'AE');
}

export function splitHangul(word: string): string {
  return [...word]
    .map((syllable) => {
      const code = syllable.charCodeAt(0) - 0xac00;
      if (code < 0 || code > 11171) return syllable;
      const vowel = VOWELS[Math.floor((code % 588) / 28)]!;
      const tail = TAILS[code % 28]!;
      return LEADS[Math.floor(code / 588)]! + (PAIRS[vowel] ?? vowel) + (PAIRS[tail] ?? tail);
    })
    .join('');
}

/** Jamo back into syllable blocks, as a 2-beolsik keyboard composes them while you type. */
export function composeHangul(jamo: string): string {
  const letters = [...jamo];
  const isVowel = (letter: string | undefined) => letter !== undefined && KOREAN_VOWEL_KEYS.includes(letter);
  let output = '';
  let index = 0;
  while (index < letters.length) {
    const lead = letters[index]!;
    if (!LEADS.includes(lead) || !isVowel(letters[index + 1])) {
      output += lead;
      index++;
      continue;
    }
    let vowel = letters[index + 1]!;
    index += 2;
    const compoundVowel = JOINED[vowel + (letters[index] ?? '')];
    if (compoundVowel && VOWELS.includes(compoundVowel)) {
      vowel = compoundVowel;
      index++;
    }
    let tail = '';
    const first = letters[index];
    if (first && TAILS.includes(first) && !isVowel(letters[index + 1])) {
      tail = first;
      index++;
      const cluster = JOINED[first + (letters[index] ?? '')];
      if (cluster && TAILS.includes(cluster) && !isVowel(letters[index + 1])) {
        tail = cluster;
        index++;
      }
    }
    output += String.fromCharCode(0xac00 + (LEADS.indexOf(lead) * 21 + VOWELS.indexOf(vowel)) * 28 + TAILS.indexOf(tail));
  }
  return output;
}

export const stripTones = (pinyin: string) => pinyin.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();

/** The dial letters of an answer: its lock string. */
export function lockOf(word: string, language: Language, pinyin?: string): string {
  if (language === 'ko') return splitHangul(word);
  if (language === 'zh') return stripTones(pinyin ?? '');
  return normaliseLatin(word, language);
}

/** A physical key press as a dial letter for this lock, or null if it is not one. */
export function letterFromKey(key: string, code: string, shift: boolean, language: Language): string | null {
  const alphabet = ALPHABETS[language];
  if (language === 'ko') {
    const base = KOREAN_BY_CODE[code];
    if (base) return (shift && KOREAN_SHIFT[base]) || base;
    return key.length === 1 && alphabet.includes(key) ? key : null;
  }
  if (key.length === 1) {
    const letter = normaliseLatin(key, language);
    if (letter.length === 1 && alphabet.includes(letter)) return letter;
  }
  // A kid on a Cyrillic or Hangul layout, or mid-IME, still gets the Latin letter on the key.
  const physical = /^Key([A-Z])$/.exec(code)?.[1];
  return physical && key !== 'Dead' && !/^[\x20-\x7e]$/.test(key) ? physical : null;
}
