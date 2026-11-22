// Every picture a chest may show (design §9, §B). Pictures are the device's own emoji glyphs,
// never files, so each is filed under the Emoji version that introduced it and nothing newer
// than Emoji 11.0 (2018) is allowed: a 2019 phone still draws them all. No people, flags or
// skin tones. Only words.test.ts reads this; the lists carry their pictures themselves.

const BY_VERSION: Record<string, string> = {
  '1.0':
    '⌚⏰☀️☁️☂️☃️☄️☕♟️⚓⚙️⚡⚽⚾⛈️⛰️⛲⛳⛴️⛵⛸️⛺✂️✈️✉️✏️❄️❤️⭐🌀🌃🌅🌈🌊🌋🌌🌍🌕🌙🌠🌦️🌧️🌫️🌬️🌭🌮🌰🌱🌲🌳🌴🌵🌶️🌷🌸🌹🌼🌽🌾🌿🍀🍁🍂🍃🍄🍅🍇🍈🍉🍊🍋🍌🍍🍎🍐🍑🍒🍓🍔🍕🍖🍗🍚🍛🍜🍝🍞🍟🍠🍣🍦🍩🍪🍫🍬🍮🍯🍰🍱🍲🍳🍴🍵🍽️🍿🎀🎁🎂🎆🎈🎉🎒🎡🎣🎤🎨🎪🎫🎬🎵🎶🎸🎹🎺🎻🎾🎿🏀🏅🏆🏉🏍️🏎️🏐🏒🏔️🏕️🏖️🏙️🏜️🏝️🏠🏢🏨🏫🏮🏰🐂🐃🐄🐆🐇🐈🐊🐌🐍🐐🐑🐒🐓🐔🐕🐗🐘🐙🐚🐛🐜🐝🐞🐟🐠🐢🐤🐦🐨🐩🐫🐬🐭🐯🐰🐱🐳🐴🐶🐷🐸🐺🐻🐼🐿️👑👒👓👕👖👗👛👜👞👟👢💍💎💡💧💻📁📄📅📎📏📓📖📝📞📦📯📰📱📷📺📻🔋🔌🔍🔑🔒🔔🔧🔨🔩🕊️🕯️🖊️🖌️🖍️🖼️🗺️🚀🚆🚇🚉🚋🚌🚕🚗🚚🚜🚡🚢🚪🚲🚿🛁🛋️🛏️🛤️🛥️🤖🦀🦁🦃🧀',
  '3.0': '🛒🛴🛵🛶🥁🥄🥅🥒🥓🥔🥕🥗🥘🥚🥛🥜🥝🥞🦅🦆🦈🦉🦊🦋🦌🦍🦎🦏🦐🦑',
  '5.0': '🛷🛸🥟🥢🥣🥥🥧🥨🥩🥫🦒🦓🦔🦕🦗🧢🧣🧤🧥🧦',
  '11.0': '🛹🥬🥭🥮🥯🥾🦘🦙🦚🦛🦜🦝🦞🦡🦢🦴🦷🧁🧂🧧🧩🧱🧲🧳🧵🧶🧸🧹🧺🧼🧽',
};

const glyphs = (text: string) => [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text)].map((part) => part.segment);

/** Each allowed picture and the Emoji version that introduced it. */
export const PICTURES = new Map(Object.entries(BY_VERSION).flatMap(([version, text]) => glyphs(text).map((glyph) => [glyph, Number(version)] as const)));
