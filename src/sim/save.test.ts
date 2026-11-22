import { describe, expect, it } from 'vitest';
import { SAVE_KEY, freshSave, loadSave, parseSave, serializeSave, shelve, writeSave } from './save.js';
import { buildList } from './words.js';

const fixture =
  '{"v":1,"words":"es","size":"M","chests":{"en":{"S":{"id":"FROG","tries":["FORG"],"lantern":0,"dials":["F","","","G"],"gold":[0,3],"cursor":1}}},"shelf":{"en":[{"id":"FISH","w":"fish","pic":"🐟","star":true}],"zh":[{"id":"XIGUA","w":"西瓜","pic":"🍉","py":"xīguā","star":false}]},"later":[{"language":"en","size":"M","id":"HORSE","wait":4}],"tier":{"S":{"level":2,"streak":1,"slips":0,"easy":3},"M":{"level":1,"streak":0,"slips":1,"easy":0},"L":{"level":1,"streak":0,"slips":0,"easy":0}},"settings":{"muted":true,"reducedMotion":null,"abc":true,"lowercase":false}}';

describe('the save (§C)', () => {
  it('round-trips the version 1 fixture byte for byte', () => {
    expect(serializeSave(parseSave(fixture))).toBe(fixture);
    expect(parseSave(fixture).returning).toBe(true);
    expect(parseSave(null).returning).toBe(false);
  });

  it('falls back field by field', () => {
    const loaded = parseSave('{"words":"xx","size":"XL","chests":{"en":{"S":{"id":"FROG","tries":["FORG","TOOLONG"],"dials":["F","Q","",""],"gold":[0,1,9],"cursor":7}},"tlh":{"S":{"id":"QAPLA"}}},"shelf":{"en":[{"id":"FISH"},{"id":"BEAR","w":"bear","star":"yes"}]},"later":[{"language":"en","size":"M","id":"HORSE","wait":-1}],"tier":{"S":{"level":7}},"settings":{"muted":"no","abc":true}}');
    const { save } = loaded;
    expect(save.words).toBeNull();
    expect(save.size).toBe('S');
    expect(save.chests.en?.S).toEqual({ id: 'FROG', tries: ['FORG'], lantern: 0, dials: ['F', 'Q', '', ''], gold: [0], cursor: 0 });
    expect(Object.keys(save.chests)).toEqual(['en']);
    expect(save.shelf.en).toEqual([{ id: 'BEAR', w: 'bear', star: false }]);
    expect(save.later).toEqual([]);
    expect(save.tier.S.level).toBe(1);
    expect(save.settings).toEqual({ muted: false, reducedMotion: null, abc: true, lowercase: false });
  });

  it('rescues the shelf from corrupt JSON', () => {
    const loaded = parseSave(fixture.slice(0, fixture.indexOf('"later"') - 30));
    expect(loaded.save.shelf.en).toEqual([{ id: 'FISH', w: 'fish', pic: '🐟', star: true }]);
    expect(loaded.save.chests).toEqual({});
    expect(parseSave('][').save).toEqual(freshSave());
  });

  it('keeps the fields and version of a save from a newer game', () => {
    const loaded = parseSave('{"v":4,"size":"L","stickers":["owl"]}');
    expect(loaded.version).toBe(4);
    expect(JSON.parse(serializeSave(loaded))).toMatchObject({ v: 4, stickers: ['owl'], size: 'L' });
  });

  it('plays on when storage is missing or throws, and writes one key only', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(loadSave(throwing).save).toEqual(freshSave());
    expect(() => writeSave(loadSave(throwing), throwing)).not.toThrow();
    const written = new Map<string, string>();
    writeSave(parseSave(fixture), { getItem: (key) => written.get(key) ?? null, setItem: (key, value) => void written.set(key, value) });
    expect([...written.keys()]).toEqual([SAVE_KEY]);
  });

  it('puts an opened chest on the shelf once, with its own spelling and picture, and keeps its ✦', () => {
    const save = freshSave();
    const [watermelon] = buildList('zh', [{ w: '西瓜', py: 'xīguā', pic: '🍉', fam: 1 }]).S;
    shelve(save, 'zh', watermelon!, false);
    shelve(save, 'zh', watermelon!, true);
    shelve(save, 'zh', watermelon!, false);
    expect(save.shelf.zh).toEqual([{ id: 'XIGUA', w: '西瓜', pic: '🍉', py: 'xīguā', star: true }]);
  });
});
