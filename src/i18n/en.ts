// English, the reference table. Every other language has exactly these keys and the same
// {placeholders} (i18n.test.ts). "Letterlock" is a name and is never translated (§11). None of
// these is on the play screen: a word game needs letters, never instructions.
export const en = {
  'aria.game': "Letterlock. Type a word on the lock's dials, then press Enter to turn the key.",
  'aria.dial': 'Letter {position}: {letter}',
  'aria.dialEmpty': 'Letter {position}: empty',
  'mark.gold': 'right place',
  'mark.blue': 'in the word, another place',
  'mark.pewter': 'not in the word',
  'aria.turnKey': 'Turn the key',
  'aria.rubOut': 'Rub out',
  'aria.shift': 'Double letters',
  'aria.lantern': 'Lantern: a little help',
  'aria.setAside': 'Set this chest aside for later',
  'aria.size': 'Chest with {count} dials',
  'aria.shelf': 'Shelf',
  'aria.mute': 'Turn sound off',
  'aria.unmute': 'Turn sound on',
  'aria.pause': 'Pause',
  'aria.keysLeft': '{count} keys left',
  'aria.chestNumber': 'Chest number {number}',
  'aria.try': 'Try {number}',
  'announce.opened': 'The chest is open: {word}',
  'announce.revealed': 'Out of keys. The word was {word}',
  'pause.title': 'Paused',
  'pause.resume': 'Keep playing',
  'settings.sound': 'Sound',
  'settings.wordsIn': 'Words in',
  'settings.abc': 'A-B-C keyboard',
  'settings.lowercase': 'Small letters',
  'settings.motion': 'Calm motion',
  'shelf.title': 'Shelf',
  'shelf.empty': 'Open a chest and its treasure goes here.',
  'shelf.number': 'Open a chest by its number',
  'shelf.open': 'Open chest',
  'common.back': 'Back',
  'reveal.next': 'Next chest',
} as const;

export type StringKey = keyof typeof en;
export type Table = Record<StringKey, string>;
