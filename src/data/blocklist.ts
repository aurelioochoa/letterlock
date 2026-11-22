// Test fixture, never shipped (design §B, §15.5): words no answer may be, in any of the eight
// languages, because a word harmless in one language can be rude, scary or loaded in another
// (Norwegian "fart" is speed; "pico" is vulgar in Chile; "cocô" makes COCO unusable). The
// union applies to every list, compared on the dial letters and on the real spelling.

/** Whole words: an answer may not be one of these, in any list. */
export const BLOCKED_WORDS = [
  // en
  'ass arse butt poop pee piss crap damn hell fart turd shit fuck dick cock cunt twat tits boob boobs penis vagina sex sexy porn nude naked kill dead death die blood gun guns bomb knife war nazi slut whore bitch bastard wank prick pussy fag drunk beer wine vodka drug drugs weed smoke devil demon ghost satan coffin grave skull',
  // es
  'culo caca pis pedo mierda puta puto joder coño polla pene teta tetas verga pinga concha chocho cabrón maricón pendejo pico paja coger bicho mamar muerte muerto sangre pistola bomba guerra diablo demonio fantasma cerveza vino droga borracho cuchillo',
  // de
  'arsch kacke pisse furz scheiße fick ficken fotze titte pimmel schwanz möse hure nutte wichser blut tod tot leiche waffe bombe krieg teufel geist gespenst bier schnaps droge messer',
  // pt
  'cu bunda cocô xixi peido merda porra caralho buceta foda pica pinto piroca peru rola pau bosta cacete viado rapariga xoxota morte morto sangue arma guerra diabo demônio cerveja vinho bêbado faca',
  // fr
  'cul pipi prout pet merde putain pute con conne bite zizi chatte nichon salope enculé foutre nique chier queue couille crotte mort sang fusil diable démon fantôme bière vin drogue couteau',
  // no
  'fitte kuk pikk pule knulle ræv rumpe tiss bæsj promp dritt faen helvete jævel hore pupp død blod våpen krig djevel spøkelse øl sprit kniv dop',
  // ko
  '씨발 시발 개새끼 병신 좆 존나 지랄 미친 똥 오줌 방귀 섹스 죽음 피 총 폭탄 전쟁 악마 귀신 유령 술 맥주 담배 마약 칼 고추',
  // zh
  '屎 尿 屁 操 肏 逼 婊 鸡巴 傻逼 妈的 他妈 死 杀 血 枪 炸弹 战争 鬼 魔鬼 酒 烟 毒品 刀 shabi caonima jiba',
].flatMap((line) => line.split(' '));

/** The strongest terms: not even inside a longer answer. */
export const BLOCKED_INSIDE = ['fuck', 'shit', 'cunt', 'nigg', 'porn', 'wank', 'fick', 'fotze', 'mierda', 'caralho', 'buceta', 'putain', 'salope', 'fitte', 'knull', '씨발', '좆', '屎', '屌', '肏', '婊'];
