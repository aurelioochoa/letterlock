// The windmill loft (design §3–§10): one chest on screen, its lock, the tries above it, the
// keys below. Everything a kid can do is a real <button>; the play screen holds no words, only
// letters. No animation loop runs while idle: motion is CSS, started by a class change.

import { Sound } from './audio/sound.js';
import { translate, type StringKey } from './i18n/index.js';
import { isFull, keysLeft, lanternStep, moveCursor, newChest, rollDial, rubOut, tapDial, turnKey, typeLetter, type Chest, type TurnResult } from './sim/chest.js';
import { ALPHABETS, KOREAN_SHIFT, LANGUAGES, NATIVE_NAMES, composeHangul, keyboardRows, letterFromKey, type Language } from './sim/letters.js';
import { bestMarks, markTry, triesWithoutNewGold, type Mark } from './sim/marking.js';
import { afterChest, dueLater, returningTier, sendLater, tickLater } from './sim/progress.js';
import { loadSave, shelve, writeSave } from './sim/save.js';
import { KEYS, SIZES, buildList, dialsFor, drawAnswer, type Answer, type AnswerLine, type Size, type WordList } from './sim/words.js';
import { ICONS, chestIcon, keyRing } from './ui/icons.js';

// Each language's words are their own lazy chunk: a session downloads one list (§12).
const LOADERS = import.meta.glob<AnswerLine[]>('./data/words/*/answers.json', { import: 'default' });
const DIAL_STEP_MS = 150;
const LAST_DIAL_EXTRA_MS = 100;
const DRAG_STEP_PX = 22;
const PAINTS = ['#6d9be8', '#e8826d', '#a98be0', '#e3a93f', '#e87da6', '#4fb0c6'];
const MARK_SYMBOL: Record<Mark, string> = { gold: '✓', blue: '↔', pewter: '' };

type Phase = 'play' | 'marking' | 'reveal';
type Overlay = 'pause' | 'shelf' | null;

function element<Tag extends keyof HTMLElementTagNameMap>(tag: Tag, className = '', html = ''): HTMLElementTagNameMap[Tag] {
  const node = document.createElement(tag);
  node.className = className;
  node.innerHTML = html;
  return node;
}

function button(className: string, html: string, label: string, onPress: () => void): HTMLButtonElement {
  const node = element('button', className, html);
  node.type = 'button';
  node.setAttribute('aria-label', label);
  node.addEventListener('click', onPress);
  return node;
}

/** Can this device draw a colour emoji? Tofu boxes and blank glyphs have no colour (§9). */
function probeEmoji(): boolean {
  try {
    const canvas = element('canvas');
    canvas.width = canvas.height = 24;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.font = '20px sans-serif';
    context.textBaseline = 'top';
    context.fillStyle = '#000';
    context.fillText('🐸', 0, 0);
    const pixels = context.getImageData(0, 0, 24, 24).data;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3]! > 0 && Math.max(Math.abs(pixels[index]! - pixels[index + 1]!), Math.abs(pixels[index + 1]! - pixels[index + 2]!)) > 24) return true;
    }
    return false;
  } catch {
    return true;
  }
}

export class Game {
  private readonly loaded = loadSave();
  private readonly save = this.loaded.save;
  private readonly sound = new Sound();
  private readonly lists: Partial<Record<Language, WordList>> = {};
  private readonly emojiDrawn = probeEmoji();
  private language: Language;
  private size: Size;
  private answer!: Answer;
  private chest!: Chest;
  private phase: Phase = 'play';
  private overlay: Overlay = null;
  private pending: TurnResult | null = null;
  private shift = false;
  private timer = 0;
  private numberSize: Size;
  private numberEntry = '';
  private drag: { index: number; startY: number; rolled: number } | null = null;

  private readonly loft = element('div', 'loft');
  private readonly history = element('ol', 'tries');
  private readonly chestNode = element('div', 'chest');
  private readonly windowNode = element('div', 'window');
  private readonly composeNode = element('div', 'compose');
  private readonly lock = element('div', 'lock');
  private readonly plate = element('span', 'plate');
  private readonly ring = element('span', 'ring');
  private readonly reveal = element('div', 'reveal');
  private readonly keyboard = element('div', 'keyboard');
  private readonly live = element('p', 'live');
  private readonly lantern = button('tool lantern', ICONS.lantern, translate('aria.lantern'), () => this.useLantern());
  private readonly setAsideButton = button('tool set-aside', ICONS.setAside, translate('aria.setAside'), () => this.setAside());
  private readonly sizeButtons = {} as Record<Size, HTMLButtonElement>;
  private readonly shelfButton = button('round', ICONS.shelf, translate('aria.shelf'), () => this.openOverlay('shelf'));
  private readonly muteButton = button('round', '', '', () => this.toggleMute());
  private readonly pauseButton = button('round', ICONS.pause, translate('aria.pause'), () => this.openOverlay('pause'));
  private scrim: HTMLElement | null = null;

  constructor(private readonly root: HTMLElement, private readonly uiLanguage: Language) {
    this.language = this.save.words ?? uiLanguage;
    this.size = this.save.size;
    this.numberSize = this.size;
    if (this.loaded.returning) for (const size of SIZES) this.save.tier[size] = returningTier(this.save.tier[size]);
    this.sound.setMuted(this.save.settings.muted);
    this.build();
    this.applyMotion();
    window.addEventListener('keydown', (event) => this.onKey(event));
    window.addEventListener('pointerdown', () => this.sound.unlock(), { capture: true });
    document.addEventListener('visibilitychange', () => document.hidden && this.sound.suspend());
    (window as unknown as { __letterlock: unknown }).__letterlock = { state: () => this.state() };
    // A list chunk that fails to load (an interrupted update) leaves the lock as it was.
    void this.useWords(this.language).catch(() => {});
  }

  private state() {
    return { language: this.language, size: this.size, answer: this.answer, chest: this.chest, phase: this.phase, overlay: this.overlay, emojiDrawn: this.emojiDrawn };
  }

  // ---- building the screen -----------------------------------------------------------

  private build(): void {
    const stage = element('main', 'stage');
    const lid = element('div', 'lid');
    lid.append(this.windowNode);
    const front = element('div', 'front');
    front.append(this.plate, this.ring, this.setAsideButton);
    // The lantern sits on the lid but comes after the lock in Tab order (§10).
    this.chestNode.append(lid, this.composeNode, this.lock, this.lantern, front);
    this.chestNode.setAttribute('aria-label', translate('aria.game'));
    this.chestNode.setAttribute('role', 'group');
    const nextButton = button('primary next', ICONS.play, translate('reveal.next'), () => this.next());
    this.reveal.append(element('div', 'treasure'), element('p', 'spelling'), element('p', 'pinyin'), nextButton);
    this.reveal.hidden = true;
    stage.append(this.history, this.reveal, this.chestNode, this.keyboard);
    const toolbar = element('header', 'toolbar');
    const sizes = element('div', 'sizes');
    for (const size of SIZES) {
      this.sizeButtons[size] = button('size', '', '', () => this.chooseSize(size));
      sizes.append(this.sizeButtons[size]);
    }
    toolbar.append(sizes, element('span', 'spacer'), this.shelfButton, this.muteButton, this.pauseButton);
    this.live.setAttribute('aria-live', 'polite');
    this.root.append(this.loft, stage, toolbar, this.live);
    this.renderMute();
  }

  private buildKeyboard(): void {
    const rows = keyboardRows(this.language, this.save.settings.abc);
    const korean = this.language === 'ko' && !this.save.settings.abc;
    this.keyboard.replaceChildren();
    const turnKeyButton = this.key('wide turn', ICONS.key, translate('aria.turnKey'), () => this.turn());
    const rubOutButton = this.key('wide rub', ICONS.rubOut, translate('aria.rubOut'), () => this.rub());
    rows.forEach((letters, rowIndex) => {
      const row = element('div', 'row');
      if (rowIndex === 2) row.append(korean ? this.key('wide shift', ICONS.shift, translate('aria.shift'), () => this.toggleShift()) : turnKeyButton);
      for (const letter of letters) {
        const key = this.key('letter', '', letter, () => this.press(this.shift ? (KOREAN_SHIFT[letter] ?? letter) : letter));
        key.dataset.letter = letter;
        row.append(key);
      }
      if (rowIndex === 1 && korean) row.append(turnKeyButton);
      if (rowIndex === 2) row.append(rubOutButton);
      this.keyboard.append(row);
    });
    const widest = Math.max(...[...this.keyboard.children].map((row) => [...row.children].reduce((sum, key) => sum + (key.classList.contains('wide') ? 1.5 : 1), 0)));
    this.keyboard.style.setProperty('--units', String(widest));
  }

  /** An on-screen key: it acts on pointer down, like a phone keyboard, and keeps focus on the lock. */
  private key(className: string, html: string, label: string, onPress: () => void): HTMLButtonElement {
    const key = element('button', `key ${className}`, html);
    key.type = 'button';
    key.tabIndex = -1;
    key.setAttribute('aria-label', label);
    key.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.sound.unlock();
      onPress();
      if (event.pointerType !== 'mouse') this.popUp(key);
    });
    key.addEventListener('click', (event) => event.detail === 0 && onPress());
    return key;
  }

  /** The pressed letter pops up above the thumb (§10). */
  private popUp(key: HTMLElement): void {
    if (!key.dataset.letter) return;
    const bubble = element('span', 'pop', key.textContent ?? '');
    key.append(bubble);
    setTimeout(() => bubble.remove(), 180);
  }

  // ---- words, chests and the flow between them ----------------------------------------

  private async useWords(language: Language): Promise<void> {
    const path = `./data/words/${language}/answers.json`;
    this.lists[language] ??= buildList(language, await LOADERS[path]!());
    this.language = language;
    document.documentElement.lang = language;
    this.buildKeyboard();
    this.startChest();
    if (document.hasFocus() && !this.overlay) this.focusLock();
  }

  private draw(list: Answer[]): Answer {
    const due = dueLater(this.save.later, this.language, this.size);
    if (due) {
      this.save.later = this.save.later.filter((entry) => entry !== due);
      const answer = list.find((candidate) => candidate.id === due.id);
      if (answer) return answer;
    }
    const waiting = this.save.later.filter((entry) => entry.language === this.language).map((entry) => entry.id);
    const seen = new Set([...(this.save.shelf[this.language] ?? []).map((entry) => entry.id), ...waiting]);
    return drawAnswer(list, this.save.tier[this.size].level, seen, new Set([...waiting, this.answer?.id ?? '']), Math.random);
  }

  /** Boot into the chest in progress exactly as it was left; otherwise draw a new one (§5). */
  private startChest(chosen?: Answer): void {
    const list = this.lists[this.language]![this.size];
    const saved = this.save.chests[this.language]?.[this.size];
    const resumed = !chosen && saved ? list.find((candidate) => candidate.id === saved.id) : undefined;
    this.answer = resumed ?? chosen ?? this.draw(list);
    this.chest = resumed && saved ? saved : newChest(this.answer.id, this.size === 'S' && !this.emojiDrawn);
    (this.save.chests[this.language] ??= {})[this.size] = this.chest;
    this.phase = 'play';
    this.reveal.hidden = true;
    this.history.hidden = false;
    this.chestNode.classList.remove('open', 'revealed');
    this.restart(this.chestNode, 'arrive');
    this.restart(this.loft, 'sweep');
    this.renderAll();
    this.persist();
  }

  private picture(): string | undefined {
    return this.emojiDrawn ? this.answer.picture : undefined;
  }

  private clothed(): boolean {
    return this.size !== 'S' && Boolean(this.picture());
  }

  private endChest(opened: boolean): void {
    const spare = keysLeft(this.chest, this.size);
    const { record, offer } = afterChest(this.save.tier[this.size], opened, spare, KEYS[this.size]);
    this.save.tier[this.size] = record;
    this.save.later = tickLater(this.save.later, this.language, this.size);
    if (opened) shelve(this.save, this.language, this.answer, this.chest.lantern === 0);
    else this.save.later = sendLater(this.save.later, this.language, this.size, this.answer.id, Math.random);
    delete this.save.chests[this.language]![this.size];
    // The next size's icon wiggles once: an offer, never a move (§6d).
    const nextSize = SIZES[SIZES.indexOf(this.size) + 1];
    if (offer && nextSize) this.restart(this.sizeButtons[nextSize], 'wiggle');
    this.persist();
  }

  private next(): void {
    if (this.phase !== 'reveal') return;
    clearTimeout(this.timer);
    this.startChest();
    if (document.hasFocus()) this.focusLock();
  }

  // ---- what a kid does -------------------------------------------------------------------

  private press(letter: string): void {
    if (this.overlay) return;
    if (this.phase === 'marking') this.settle();
    if (this.phase === 'reveal') this.next();
    typeLetter(this.chest, letter);
    this.shift = false;
    this.sound.ratchet();
    this.renderEdit();
  }

  private rub(): void {
    if (this.overlay || this.phase === 'reveal') return;
    if (this.phase === 'marking') this.settle();
    rubOut(this.chest);
    this.sound.ratchet();
    this.renderEdit();
  }

  private toggleShift(): void {
    this.shift = !this.shift;
    this.renderKeyboard();
  }

  private turn(): void {
    if (this.overlay) return;
    if (this.phase === 'reveal') return this.next();
    // Enter during the marks only skips their show.
    if (this.phase === 'marking') return this.settle();
    if (!isFull(this.chest)) return this.restart(this.keyboard.querySelector('.turn') ?? this.lock, 'nudge');
    const result = turnKey(this.chest, this.size);
    this.pending = result;
    this.phase = 'marking';
    const calm = this.calm();
    this.sound.keyTurn();
    result.marks.forEach((mark, index) => this.sound.mark(mark, index, calm ? 0.15 : 0.15 + this.dialDelay(index, result.marks.length) / 1000));
    this.renderDials(result);
    this.renderRing();
    this.announce(
      `${translate('aria.try', { number: this.chest.tries.length })}: ${result.marks.map((mark, index) => `${this.display([...result.guess][index]!)} ${translate(`mark.${mark}`)}`).join(', ')}`,
    );
    this.persist();
    this.timer = window.setTimeout(() => this.settle(), calm ? 350 : this.dialDelay(result.marks.length - 1, result.marks.length) + 650);
  }

  private dialDelay(index: number, count: number): number {
    return index * DIAL_STEP_MS + (index === count - 1 ? LAST_DIAL_EXTRA_MS : 0);
  }

  /** The marks have been shown: the try floats up, and the chest opens or the next try begins. */
  private settle(): void {
    clearTimeout(this.timer);
    const result = this.pending;
    this.pending = null;
    if (this.phase !== 'marking' || !result) return;
    if (result.won || result.outOfKeys) return this.finish(result.won);
    this.phase = 'play';
    this.renderAll();
  }

  /** Every chest ends open: opened, or out of keys with the answer rolled in gold (§6c). */
  private finish(opened: boolean): void {
    this.endChest(opened);
    this.phase = 'reveal';
    this.renderAll();
    if (!opened) this.renderDials(null, true);
    const picture = this.picture();
    const [treasure, spelling, pinyin] = [...this.reveal.children] as HTMLElement[];
    treasure!.innerHTML = picture ? `<span class="picture">${picture}</span>` : ICONS.star;
    spelling!.textContent = this.answer.word;
    pinyin!.textContent = this.answer.pinyin ?? '';
    this.reveal.hidden = false;
    this.history.hidden = true;
    this.reveal.classList.toggle('starred', opened && this.chest.lantern === 0);
    this.chestNode.classList.add('open');
    this.chestNode.classList.toggle('revealed', !opened);
    if (opened) {
      this.sound.open(0);
      this.sound.plink(1.1);
      this.restart(this.shelfButton, 'plink');
      // Moves on by itself (§3), but never behind an open pause or shelf card.
      this.timer = window.setTimeout(() => this.overlay || this.next(), 3200);
    } else this.sound.sigh(0);
    this.announce(translate(opened ? 'announce.opened' : 'announce.revealed', { word: this.answer.word }));
    if (document.hasFocus()) this.reveal.querySelector<HTMLButtonElement>('.next')!.focus({ preventScroll: true });
  }

  private useLantern(): void {
    if (this.overlay || this.phase === 'reveal') return;
    if (this.phase === 'marking') this.settle();
    const step = lanternStep(this.chest, this.clothed());
    if (!step) return this.restart(this.lantern, 'nudge');
    if (step === 'cloth') this.sound.plink();
    else this.sound.mark('gold', this.chest.gold[this.chest.gold.length - 1]!, 0);
    this.renderAll();
    this.persist();
  }

  /** ↷ sends the chest to the back-later basket at no cost (§8). */
  private setAside(): void {
    if (this.overlay) return;
    if (this.phase === 'marking') this.settle();
    if (this.phase === 'reveal') return this.next();
    this.save.later = sendLater(this.save.later, this.language, this.size, this.answer.id, Math.random);
    delete this.save.chests[this.language]![this.size];
    this.sound.unlatch();
    this.startChest();
  }

  private chooseSize(size: Size): void {
    if (this.overlay || size === this.size) return;
    if (this.phase === 'marking') this.settle();
    clearTimeout(this.timer);
    this.size = this.save.size = this.numberSize = size;
    this.startChest();
  }

  private toggleMute(): void {
    this.save.settings.muted = !this.save.settings.muted;
    this.sound.setMuted(this.save.settings.muted);
    this.renderMute();
    this.persist();
  }

  // ---- input -------------------------------------------------------------------------------

  private onKey(event: KeyboardEvent): void {
    this.sound.unlock();
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement;
    if (event.key === 'Escape') {
      event.preventDefault();
      return this.overlay ? this.closeOverlay() : this.openOverlay('pause');
    }
    if (this.overlay) return this.onOverlayKey(event);
    const onTool = target instanceof HTMLButtonElement && !target.classList.contains('dial');
    if (event.key === 'Enter' || event.key === ' ') {
      if (onTool) return;
      event.preventDefault();
      if (event.key === 'Enter') this.turn();
      else if (this.phase === 'reveal') this.next();
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      return this.rub();
    }
    const arrow = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: 2, ArrowDown: -2 } as Record<string, number>)[event.key];
    if (arrow !== undefined && this.phase !== 'reveal') {
      event.preventDefault();
      if (this.phase === 'marking') this.settle();
      if (Math.abs(arrow) === 1) moveCursor(this.chest, arrow);
      else {
        rollDial(this.chest, this.chest.cursor, Math.sign(arrow), ALPHABETS[this.language]);
        this.sound.ratchet();
      }
      this.renderEdit();
      return this.focusLock();
    }
    const letter = letterFromKey(event.key, event.code, event.shiftKey, this.language);
    if (!letter) return;
    event.preventDefault();
    this.press(letter);
    this.focusLock();
  }

  private onOverlayKey(event: KeyboardEvent): void {
    const buttons = [...(this.scrim?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const step = ({ ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 } as Record<string, number>)[event.key];
    if (step !== undefined && buttons.length) {
      event.preventDefault();
      const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[(at + step + buttons.length) % buttons.length]!.focus();
    } else if (this.overlay === 'shelf' && /^[0-9]$/.test(event.key)) {
      event.preventDefault();
      this.typeNumber(event.key);
    } else if (this.overlay === 'shelf' && event.key === 'Backspace') {
      event.preventDefault();
      this.typeNumber('');
    }
  }

  private wireDial(dial: HTMLButtonElement, index: number): void {
    dial.addEventListener('pointerdown', (event) => {
      if (this.overlay) return;
      this.drag = { index, startY: event.clientY, rolled: 0 };
      dial.setPointerCapture(event.pointerId);
    });
    dial.addEventListener('pointermove', (event) => {
      const drag = this.drag;
      if (!drag || drag.index !== index || this.phase === 'reveal') return;
      const target = Math.trunc((drag.startY - event.clientY) / DRAG_STEP_PX);
      if (target === drag.rolled) return;
      if (this.phase === 'marking') this.settle();
      // A drag rolls the ring click by click, like a real lock (§3).
      while (drag.rolled !== target) {
        const step = Math.sign(target - drag.rolled);
        rollDial(this.chest, index, step, ALPHABETS[this.language]);
        drag.rolled += step;
        this.sound.ratchet();
      }
      this.renderEdit();
    });
    const release = () => {
      const drag = this.drag;
      this.drag = null;
      if (drag?.index === index && drag.rolled === 0) this.tap(index);
    };
    dial.addEventListener('pointerup', release);
    dial.addEventListener('pointercancel', () => (this.drag = null));
    dial.addEventListener('click', (event) => event.detail === 0 && this.tap(index));
  }

  private tap(index: number): void {
    if (this.overlay) return;
    if (this.phase === 'marking') this.settle();
    if (this.phase === 'reveal') return this.next();
    if (this.chest.gold.includes(index)) this.sound.unlatch();
    tapDial(this.chest, index);
    this.renderEdit();
    this.focusLock();
  }

  private focusLock(): void {
    this.lock.querySelector<HTMLButtonElement>('.dial[tabindex="0"]')?.focus({ preventScroll: true });
  }

  // ---- rendering ----------------------------------------------------------------------------

  private display(letter: string): string {
    return this.save.settings.lowercase || this.language === 'zh' ? letter.toLowerCase() : letter;
  }

  private renderAll(): void {
    this.chestNode.style.setProperty('--paint', PAINTS[(this.answer.number - 1) % PAINTS.length]!);
    this.chestNode.style.setProperty('--dials', String(this.answer.id.length));
    this.plate.textContent = `№ ${this.answer.number}`;
    this.plate.setAttribute('aria-label', translate('aria.chestNumber', { number: this.answer.number }));
    const picture = this.picture();
    const showCloth = this.size !== 'S' && (!picture || this.chest.lantern === 0) && this.phase !== 'reveal';
    this.windowNode.innerHTML = picture && !showCloth ? `<span class="picture">${picture}</span>` : '';
    this.windowNode.classList.toggle('cloth', showCloth);
    for (const size of SIZES) {
      const sizeButton = this.sizeButtons[size];
      const count = dialsFor(this.language, size);
      sizeButton.innerHTML = chestIcon(count);
      sizeButton.setAttribute('aria-label', translate('aria.size', { count }));
      sizeButton.setAttribute('aria-pressed', String(size === this.size));
    }
    this.history.replaceChildren(
      ...this.chest.tries.map((guess, tryIndex) => {
        const row = element('li', 'try');
        row.setAttribute('aria-label', `${translate('aria.try', { number: tryIndex + 1 })}: ${this.display(guess)}`);
        markTry(guess, this.answer.id).forEach((mark, index) => row.append(element('span', `disc ${mark}`, this.display([...guess][index]!))));
        if (this.language === 'ko') row.append(element('span', 'syllables', composeHangul(guess)));
        return row;
      }),
    );
    this.renderRing();
    this.renderDials(null);
    this.renderKeyboard();
  }

  private renderEdit(): void {
    this.renderDials(null);
    this.renderKeyboard();
    this.persist();
  }

  private renderRing(): void {
    const left = keysLeft(this.chest, this.size);
    this.ring.innerHTML = keyRing(left, KEYS[this.size]);
    this.ring.setAttribute('role', 'img');
    this.ring.setAttribute('aria-label', translate('aria.keysLeft', { count: left }));
    const glowAt = this.answer.tier === 1 ? 2 : 3;
    this.lantern.classList.toggle('glow', this.phase === 'play' && triesWithoutNewGold(this.chest.tries, this.answer.id) >= glowAt);
  }

  /**
   * The dials: the letters in progress, or a try's marks answering left to right 150 ms apart
   * (the last one waits 100 ms more), or the answer rolled in gold when the keys ran out.
   */
  private renderDials(result: TurnResult | null, rollAnswer = false): void {
    const count = this.chest.dials.length;
    if (this.lock.children.length !== count) {
      this.lock.replaceChildren(
        ...this.chest.dials.map((_, index) => {
          const dial = element('button', 'dial', '<span class="glyph"></span><span class="mark"></span>');
          dial.type = 'button';
          this.wireDial(dial, index);
          return dial;
        }),
      );
    }
    [...this.lock.children].forEach((node, index) => {
      const dial = node as HTMLButtonElement;
      const mark: Mark | null = rollAnswer ? 'gold' : result ? result.marks[index]! : this.chest.gold.includes(index) ? 'gold' : null;
      const letter = rollAnswer ? this.answer.id[index]! : result ? [...result.guess][index]! : this.chest.dials[index]!;
      dial.className = `dial${mark ? ` ${mark}` : ''}${result || rollAnswer ? ' answering' : ''}${!result && !rollAnswer && this.phase === 'play' && index === this.chest.cursor ? ' cursor' : ''}`;
      dial.style.setProperty('--delay', `${result || rollAnswer ? this.dialDelay(index, count) : 0}ms`);
      dial.querySelector('.glyph')!.textContent = this.display(letter);
      dial.querySelector('.mark')!.textContent = mark ? MARK_SYMBOL[mark] : '';
      dial.tabIndex = index === this.chest.cursor ? 0 : -1;
      const name = letter ? translate('aria.dial', { position: index + 1, letter: this.display(letter) }) : translate('aria.dialEmpty', { position: index + 1 });
      dial.setAttribute('aria-label', mark ? `${name}, ${translate(`mark.${mark}` as StringKey)}` : name);
    });
    this.composeNode.textContent = this.language === 'ko' ? composeHangul((rollAnswer ? this.answer.id : result ? result.guess : this.chest.dials.join('')) || '') : '';
    this.composeNode.hidden = this.language !== 'ko';
    this.keyboard.querySelector('.turn')?.classList.toggle('ready', this.phase === 'play' && isFull(this.chest));
  }

  private renderKeyboard(): void {
    const best = this.phase === 'marking' ? bestMarks(this.chest.tries.slice(0, -1), this.answer.id) : bestMarks(this.chest.tries, this.answer.id);
    for (const key of this.keyboard.querySelectorAll<HTMLButtonElement>('.letter')) {
      const letter = this.shift ? (KOREAN_SHIFT[key.dataset.letter!] ?? key.dataset.letter!) : key.dataset.letter!;
      const mark = best.get(letter);
      key.className = `key letter${mark ? ` ${mark}` : ''}`;
      key.textContent = this.display(letter);
      key.setAttribute('aria-label', mark ? `${this.display(letter)}, ${translate(`mark.${mark}`)}` : this.display(letter));
    }
    this.keyboard.querySelector('.shift')?.setAttribute('aria-pressed', String(this.shift));
  }

  private renderMute(): void {
    const muted = this.save.settings.muted;
    this.muteButton.innerHTML = muted ? ICONS.soundOff : ICONS.soundOn;
    this.muteButton.setAttribute('aria-label', translate(muted ? 'aria.unmute' : 'aria.mute'));
    this.muteButton.setAttribute('aria-pressed', String(muted));
  }

  private announce(message: string): void {
    this.live.textContent = message;
  }

  /** Restart a one-shot CSS animation by toggling its class. */
  private restart(node: Element, className: string): void {
    node.classList.remove(className);
    void (node as HTMLElement).offsetWidth;
    node.classList.add(className);
  }

  private calm(): boolean {
    return this.save.settings.reducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private applyMotion(): void {
    document.documentElement.toggleAttribute('data-calm', this.calm());
  }

  private persist(): void {
    writeSave(this.loaded);
  }

  // ---- pause and shelf -------------------------------------------------------------------

  private openOverlay(kind: Exclude<Overlay, null>): void {
    if (this.phase === 'marking') this.settle();
    this.overlay = kind;
    this.scrim?.remove();
    this.scrim = element('div', 'scrim');
    const card = element('section', `card card-${kind}`);
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    const title = element('h2', '', translate(kind === 'pause' ? 'pause.title' : 'shelf.title'));
    title.id = `${kind}-title`;
    card.setAttribute('aria-labelledby', title.id);
    card.append(title, ...(kind === 'pause' ? this.pauseContent() : this.shelfContent()));
    this.scrim.append(card);
    this.root.append(this.scrim);
    card.querySelector<HTMLButtonElement>('.primary, button')?.focus({ preventScroll: true });
  }

  private closeOverlay(): void {
    this.scrim?.remove();
    this.scrim = null;
    this.overlay = null;
    if (this.phase === 'reveal') this.reveal.querySelector<HTMLButtonElement>('.next')?.focus({ preventScroll: true });
    else this.focusLock();
  }

  private toggle(icon: string, key: StringKey, on: boolean, flip: () => void): HTMLButtonElement {
    const toggle = button('wide toggle', `${icon}<span>${translate(key)}</span>`, translate(key), () => {
      flip();
      toggle.setAttribute('aria-pressed', String(toggle.getAttribute('aria-pressed') !== 'true'));
      this.persist();
    });
    toggle.setAttribute('aria-pressed', String(on));
    return toggle;
  }

  private pauseContent(): HTMLElement[] {
    const settings = this.save.settings;
    const resume = button('wide primary', `${ICONS.play}<span>${translate('pause.resume')}</span>`, translate('pause.resume'), () => this.closeOverlay());
    const shelf = button('wide', `${ICONS.shelf}<span>${translate('shelf.title')}</span>`, translate('shelf.title'), () => this.openOverlay('shelf'));
    const toggles = [
      this.toggle(ICONS.soundOn, 'settings.sound', !settings.muted, () => this.toggleMute()),
      this.toggle(ICONS.motion, 'settings.motion', this.calm(), () => {
        settings.reducedMotion = !this.calm();
        this.applyMotion();
      }),
      this.toggle(ICONS.alphabet, 'settings.abc', settings.abc, () => {
        settings.abc = !settings.abc;
        this.buildKeyboard();
        this.renderKeyboard();
      }),
      this.toggle(ICONS.lowercase, 'settings.lowercase', settings.lowercase, () => {
        settings.lowercase = !settings.lowercase;
        this.renderAll();
      }),
    ];
    const words = element('div', 'words', `${ICONS.globe}<span>${translate('settings.wordsIn')}</span>`);
    for (const language of LANGUAGES) {
      const choice = button('language', NATIVE_NAMES[language], NATIVE_NAMES[language], () => {
        this.save.words = language === this.uiLanguage ? null : language;
        for (const other of words.querySelectorAll('.language')) other.setAttribute('aria-pressed', String(other === choice));
        if (language !== this.language) void this.useWords(language).catch(() => {});
        this.persist();
      });
      choice.lang = language;
      choice.setAttribute('aria-pressed', String(language === this.language));
      words.append(choice);
    }
    return [resume, shelf, ...toggles, words];
  }

  private shelfContent(): HTMLElement[] {
    const back = button('wide primary', `${ICONS.back}<span>${translate('common.back')}</span>`, translate('common.back'), () => this.closeOverlay());
    // Chest numbers (§15.4): "everyone open Medium 42", any day.
    const pad = element('div', 'number-pad');
    pad.setAttribute('role', 'group');
    pad.setAttribute('aria-label', translate('shelf.number'));
    const sizes = element('div', 'pad-sizes');
    for (const size of SIZES) {
      const choice = button('size', chestIcon(dialsFor(this.language, size)), translate('aria.size', { count: dialsFor(this.language, size) }), () => {
        this.numberSize = size;
        for (const other of sizes.children) other.setAttribute('aria-pressed', String(other === choice));
      });
      choice.setAttribute('aria-pressed', String(size === this.numberSize));
      sizes.append(choice);
    }
    const shown = element('output', 'pad-number', `№ ${this.numberEntry || '·'}`);
    const digits = element('div', 'digits');
    for (const digit of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']) {
      if (!digit) digits.append(element('span'));
      else digits.append(button('digit', digit === '⌫' ? ICONS.rubOut : digit, digit === '⌫' ? translate('aria.rubOut') : digit, () => this.typeNumber(digit === '⌫' ? '' : digit)));
    }
    const open = button('wide primary open', `${ICONS.key}<span>${translate('shelf.open')}</span>`, translate('shelf.open'), () => this.openNumber());
    pad.append(sizes, shown, digits, open);
    const entries = element('ul', 'shelf-entries');
    const languages = [this.language, ...LANGUAGES.filter((language) => language !== this.language)];
    for (const language of languages) {
      const shelf = this.save.shelf[language] ?? [];
      if (!shelf.length) continue;
      if (language !== this.language) entries.append(element('li', 'shelf-language', NATIVE_NAMES[language]));
      for (const entry of [...shelf].reverse()) {
        const item = element('li', 'shelf-entry');
        item.lang = language;
        item.append(element('span', 'picture', entry.pic && this.emojiDrawn ? entry.pic : ICONS.star), element('span', 'word', entry.w));
        if (entry.py) item.append(element('span', 'pinyin', entry.py));
        if (entry.star) item.append(element('span', 'star', '✦'));
        entries.append(item);
      }
    }
    if (!entries.children.length) entries.append(element('li', 'shelf-empty', translate('shelf.empty')));
    return [back, entries, pad];
  }

  private typeNumber(digit: string): void {
    this.numberEntry = digit ? (this.numberEntry + digit).slice(0, 3) : this.numberEntry.slice(0, -1);
    const shown = this.scrim?.querySelector('.pad-number');
    if (shown) shown.textContent = `№ ${this.numberEntry || '·'}`;
  }

  private openNumber(): void {
    const answer = this.lists[this.language]![this.numberSize].find((candidate) => candidate.number === Number(this.numberEntry));
    const shown = this.scrim?.querySelector('.pad-number');
    if (!answer) {
      if (shown) this.restart(shown, 'nudge');
      return;
    }
    const current = this.save.chests[this.language]?.[this.numberSize];
    if (current?.tries.length && current.id !== answer.id) this.save.later = sendLater(this.save.later, this.language, this.numberSize, current.id, Math.random);
    this.numberEntry = '';
    this.closeOverlay();
    clearTimeout(this.timer);
    this.size = this.save.size = this.numberSize;
    this.startChest(current?.id === answer.id ? undefined : answer);
    this.focusLock();
  }
}
