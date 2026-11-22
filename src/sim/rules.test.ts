// The rules a kid can see: marking, typing, the latch, the lantern, the tier and the basket.
import { describe, expect, it } from 'vitest';
import { lanternStep, newChest, rollDial, rubOut, tapDial, turnKey, typeLetter, type Chest } from './chest.js';
import { ALPHABETS, KOREAN_SHIFT, LANGUAGES, composeHangul, keyboardRows, letterFromKey, lockOf, normaliseLatin, splitHangul } from './letters.js';
import { bestMarks, markTry, triesWithoutNewGold } from './marking.js';
import { afterChest, dueLater, freshTier, returningTier, sendLater, tickLater } from './progress.js';
import { buildList, drawAnswer, type Answer } from './words.js';

const type = (chest: Chest, word: string) => [...word].forEach((letter) => typeLetter(chest, letter));

describe('marking (§3, §8)', () => {
  it('settles right places first, then claims each remaining copy once: FROG against GOOF', () => {
    expect(markTry('GOOF', 'FROG')).toEqual(['blue', 'pewter', 'gold', 'blue']);
    expect(markTry('FORG', 'FROG')).toEqual(['gold', 'blue', 'blue', 'gold']);
    expect(markTry('EEEE', 'TREE')).toEqual(['pewter', 'pewter', 'gold', 'gold']);
    expect(markTry('EYES', 'TREE')).toEqual(['blue', 'pewter', 'gold', 'pewter']);
    expect(markTry('LLAMA', 'HELLO')).toEqual(['blue', 'blue', 'pewter', 'pewter', 'pewter']);
  });

  it('keeps each key at its best mark: one E pewter does not hide the E that is in the word', () => {
        expect(bestMarks(['EELS'], 'BEAR').get('E')).toBe('gold');
    expect(bestMarks(['SEEN', 'EBBS'], 'TREE').get('E')).toBe('gold');
  });

  it('counts tries in a row with no new gold, for the lantern', () => {
    expect(triesWithoutNewGold(['FISH', 'MOAT', 'LUCK'], 'FROG')).toBe(2);
    expect(triesWithoutNewGold(['MOAT', 'FISH'], 'FROG')).toBe(0);
  });
});

describe('letters (§11)', () => {
  it('keeps the protected letters and drops every other mark', () => {
    expect(normaliseLatin('niño', 'es')).toBe('NIÑO');
    expect(normaliseLatin('niño', 'en')).toBe('NINO');
    expect(normaliseLatin('Bär', 'de')).toBe('BÄR');
    expect(normaliseLatin('blåbær', 'no')).toBe('BLÅBÆR');
    expect(normaliseLatin('maçã', 'pt')).toBe('MACA');
    expect(normaliseLatin('œuf', 'fr')).toBe('OEUF');
    expect(normaliseLatin('crème', 'fr')).toBe('CREME');
    expect(lockOf('西瓜', 'zh', 'xīguā')).toBe('XIGUA');
  });

  it('splits Korean syllables into the keys a 2-beolsik typist presses, and composes them back', () => {
    expect(splitHangul('사과')).toBe('ㅅㅏㄱㅗㅏ');
    expect(splitHangul('닭')).toBe('ㄷㅏㄹㄱ');
    expect(splitHangul('꽃게')).toBe('ㄲㅗㅊㄱㅔ');
    for (const word of ['사과', '닭', '달걀', '의자', '앉아', '꿀벌', '돼지', '없다']) expect(composeHangul(splitHangul(word))).toBe(word);
    expect(composeHangul('ㅅㅏㄱ')).toBe('삭');
    expect(composeHangul('ㅅㅏㄱㅗ')).toBe('사고');
    expect(composeHangul('ㄱㄱㅏ')).toBe('ㄱ가');
  });

  it('reads Latin keys by event.key and Korean by event.code with Shift', () => {
    expect(letterFromKey('ñ', 'Semicolon', false, 'es')).toBe('Ñ');
    expect(letterFromKey('é', 'Digit2', false, 'fr')).toBe('E');
    expect(letterFromKey('ß', 'Minus', false, 'de')).toBeNull();
    expect(letterFromKey('Dead', 'BracketLeft', false, 'fr')).toBeNull();
    expect(letterFromKey('ф', 'KeyA', false, 'en')).toBe('A');
    expect(letterFromKey('Process', 'KeyR', false, 'ko')).toBe('ㄱ');
    expect(letterFromKey('ㄲ', 'KeyR', true, 'ko')).toBe('ㄲ');
    expect(letterFromKey('ㅒ', 'KeyO', true, 'ko')).toBe('ㅒ');
    expect(letterFromKey('1', 'Digit1', false, 'ko')).toBeNull();
  });

  it.each(LANGUAGES)('%s: both keyboards hold every lock letter exactly once', (language) => {
    const shifted = language === 'ko' ? Object.values(KOREAN_SHIFT).join('') : '';
    for (const [keys, extra] of [[keyboardRows(language, false).join(''), shifted], [keyboardRows(language, true).join(''), '']] as const) {
      expect([...keys + extra].sort()).toEqual([...ALPHABETS[language]].sort());
    }
  });
});

describe('a chest (§4, §8)', () => {
  it('latches gold between tries, skips it when typing, and clears the rest', () => {
    const chest = newChest('FROG', false);
    type(chest, 'FORG');
    const result = turnKey(chest, 'S');
    expect(result.marks).toEqual(['gold', 'blue', 'blue', 'gold']);
    expect(chest.dials).toEqual(['F', '', '', 'G']);
    expect(chest.cursor).toBe(1);
    type(chest, 'RO');
    expect(chest.dials.join('')).toBe('FROG');
    expect(turnKey(chest, 'S').won).toBe(true);
  });

  it('rubs out the open letters only, right to left', () => {
    const chest = newChest('FROG', false);
    type(chest, 'FORG');
    turnKey(chest, 'S');
    type(chest, 'XY');
    rubOut(chest);
    rubOut(chest);
    rubOut(chest);
    expect(chest.dials).toEqual(['F', '', '', 'G']);
  });

  it('frees a gold dial with a tap, rolls a dial through the alphabet, and wraps', () => {
    const chest = newChest('FROG', true);
    expect(chest.gold).toEqual([0]);
    tapDial(chest, 0);
    expect(chest.gold).toEqual([]);
    expect(chest.cursor).toBe(0);
    rollDial(chest, 1, -1, ALPHABETS.en);
    expect(chest.dials[1]).toBe('Z');
    rollDial(chest, 1, 1, ALPHABETS.en);
    expect(chest.dials[1]).toBe('A');
  });

  it('opens anyway once the keys run out', () => {
    const chest = newChest('FROG', false);
    for (let tryNumber = 1; tryNumber <= 7; tryNumber++) {
      type(chest, 'MILK');
      expect(turnKey(chest, 'S').outOfKeys).toBe(tryNumber === 7);
    }
  });

  it('lifts the cloth first, then latches the leftmost open dial, and always leaves the last one', () => {
    const chest = newChest('HORSE', false);
    expect(lanternStep(chest, true)).toBe('cloth');
    expect(lanternStep(chest, true)).toBe('latch');
    expect(chest.dials).toEqual(['H', '', '', '', '']);
    for (let tap = 0; tap < 3; tap++) lanternStep(chest, true);
    expect(chest.gold).toEqual([0, 1, 2, 3]);
    expect(lanternStep(chest, true)).toBeNull();
    expect(chest.lantern).toBe(5);
    expect(lanternStep(newChest('FROG', false), false)).toBe('latch');
  });
});

describe('the silent tier and the back-later basket (§6c, §6d)', () => {
  it('steps up after three chests with two keys to spare, down after a reveal or two last-key opens', () => {
    let record = freshTier();
    for (let chest = 0; chest < 3; chest++) record = afterChest(record, true, 3, 6).record;
    expect(record.level).toBe(2);
    record = afterChest(record, false, 0, 6).record;
    expect(record.level).toBe(1);
    record = { ...record, level: 3 };
    record = afterChest(record, true, 0, 6).record;
    expect(record.level).toBe(3);
    record = afterChest(record, true, 0, 6).record;
    expect(record.level).toBe(2);
    expect(returningTier({ ...record, level: 1 }).level).toBe(1);
    expect(returningTier(record).level).toBe(1);
  });

  it('wiggles the next size once after five easy opens in a row', () => {
    let record = freshTier();
    const offers = [];
    for (let chest = 0; chest < 10; chest++) {
      const result = afterChest(record, true, 4, 7);
      record = result.record;
      offers.push(result.offer);
    }
    expect(offers).toEqual([false, false, false, false, true, false, false, false, false, true]);
  });

  it('brings a revealed word back 5 to 10 chests later, counted in chests of its size', () => {
    for (const random of [0, 0.999]) {
      let later = sendLater([], 'en', 'M', 'HORSE', () => random);
      const wait = later[0]!.wait;
      expect(wait).toBe(random === 0 ? 5 : 10);
      later = tickLater(later, 'en', 'S');
      later = tickLater(later, 'es', 'M');
      expect(later[0]!.wait).toBe(wait);
      for (let chest = 0; chest < wait; chest++) {
        expect(dueLater(later, 'en', 'M')).toBeUndefined();
        later = tickLater(later, 'en', 'M');
      }
      expect(dueLater(later, 'en', 'M')?.id).toBe('HORSE');
    }
  });

  it('draws the teaching chests first, then the nearest tier, then reshuffles skipping the basket', () => {
    const list = buildList('en', [
      { w: 'frog', fam: 1, pic: '🐸', teach: true },
      { w: 'fish', fam: 1, pic: '🐟', teach: true },
      { w: 'bear', fam: 1, pic: '🐻' },
      { w: 'yarn', fam: 3, pic: '🧶' },
    ]).S;
    const ids = (answers: Answer[]) => answers.map((answer) => answer.id);
    expect(drawAnswer(list, 1, new Set(), new Set(), Math.random).id).toBe('FROG');
    expect(drawAnswer(list, 1, new Set(['FROG']), new Set(), Math.random).id).toBe('FISH');
    expect(drawAnswer(list, 3, new Set(['FROG', 'FISH']), new Set(), () => 0).id).toBe('YARN');
    const seen = new Set(ids(list));
    for (let draw = 0; draw < 20; draw++) expect(['FROG', 'FISH']).toContain(drawAnswer(list, 1, seen, new Set(['BEAR', 'YARN']), Math.random).id);
  });
});
