// Does the built game work for a kid? Drives the production build (`vite preview` over dist/)
// in headless Chromium with real input (design §12):
//
//   1. desktop 1280×720 by KEYS ONLY: a first visit opens straight on the teaching chest (FROG);
//      FORG marks gold, blue, blue, gold and the gold stays latched; the chest opens onto the
//      shelf; Tab walks lantern, set aside, sizes, shelf, mute, pause; a letter returns focus to
//      the lock; the lantern; the pause card's A-B-C keyboard; a Medium chest out of keys goes
//      to the back-later basket; Medium № 42 from the shelf's number pad; mute; a reload boots
//      into the chest exactly as it was left; six tries all stay on screen;
//   2. phone 360×640 by real touch taps: the 54 px keys, 48 px toolbar, 56 px dials; a tap on
//      gold unlatches; a drag rolls a dial; a chest opened by taps; six tries on screen; pause,
//      shelf and a landscape capture;
//   3. Korean by event.code, with Shift for ㄲ and an IME's "Process" key: jamo compose to 나무;
//   4. Chinese pinyin: XIGUA opens 西瓜 xīguā;
//   5. inside an iframe with the site's exact /play/[id] sandbox: keys reach the game and save;
//   6. every string blanked (?blank=1): no label anywhere, and every control keeps an icon;
//   7. a device that draws no emoji: Small chests latch their first letter instead (§9).
//
// Fails on any console error, page error, failed or external request. Every wait is a deadline
// with polling, never a fixed sleep for a condition. Screenshots go to /tmp/letterlock-shots
// (or $SHOTS), outside the zero-asset source tree.
//
//   npm run build && npm run smoke
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const port = 4600 + (process.pid % 300);
const base = `http://localhost:${port}/`;
const shots = process.env.SHOTS ?? '/tmp/letterlock-shots/';
mkdirSync(shots, { recursive: true });

const failures = [];
const fail = (message) => {
  failures.push(message);
  console.error(`FAIL: ${message}`);
};
const check = (condition, message) => condition || fail(message);
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/** Poll `probe` until it returns something truthy or the deadline passes. */
async function until(probe, milliseconds, label) {
  const deadline = Date.now() + milliseconds;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await probe();
      if (last) return last;
    } catch (error) {
      last = error.message;
    }
    await wait(25);
  }
  throw new Error(`timed out waiting for ${label} (last: ${JSON.stringify(last)})`);
}

const server = spawn(process.execPath, [`${root}node_modules/vite/bin/vite.js`, 'preview', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore' });
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

function watch(page, tag) {
  page.on('console', (message) => message.type() === 'error' && fail(`[${tag}] console error: ${message.text()}`));
  page.on('pageerror', (error) => fail(`[${tag}] page error: ${error.message}`));
  page.on('requestfailed', (request) => fail(`[${tag}] request failed: ${request.url()}`));
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(base) && !url.startsWith('data:') && !url.startsWith('blob:')) fail(`[${tag}] external request: ${url}`);
  });
}

const state = (frame) => frame.evaluate(() => JSON.parse(JSON.stringify(window.__letterlock?.state() ?? null)));
const saved = (frame) => frame.evaluate(() => JSON.parse(localStorage.getItem('letterlock:save') ?? 'null'));
const phase = (frame, wanted) => until(async () => (await state(frame))?.phase === wanted && state(frame), 8000, `phase ${wanted}`);
const ready = (frame) => until(async () => (await state(frame))?.answer?.id && (await state(frame)).phase === 'play' && state(frame), 10000, 'a chest on the lock');
const focused = (frame) => frame.evaluate(() => `${document.activeElement?.className}|${document.activeElement?.getAttribute('aria-label')}`);

async function typeWord(page, word) {
  for (const letter of word) await page.keyboard.press(`Key${letter}`);
}

/** Fill every open dial with `letter` by keys, then turn the key and wait out the marks. */
async function wrongTryByKeys(page, letter) {
  for (let presses = 0; presses < 8 && !(await state(page)).chest.dials.every(Boolean); presses++) await page.keyboard.press(`Key${letter}`);
  await page.keyboard.press('Enter');
  await until(async () => (await state(page)).phase !== 'marking', 5000, 'the marks to settle');
}

async function settled(page, selector) {
  await until(() => page.locator(selector).isVisible(), 5000, selector);
  await until(
    () => page.evaluate((query) => document.querySelector(query).getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running').length === 0, selector),
    4000,
    `${selector} settled`,
  );
}

/** Every try row inside the viewport: the board grows upward and nothing scrolls away (§8). */
async function triesOnScreen(page) {
  await settled(page, '.tries');
  return page.evaluate(() => [...document.querySelectorAll('.try')].every((row) => row.getBoundingClientRect().top >= 0 && row.getBoundingClientRect().bottom <= innerHeight));
}

try {
  await until(async () => (await fetch(base)).ok, 20000, 'vite preview');

  // ---- 1. desktop, keys only --------------------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en-US' });
    const page = await context.newPage();
    watch(page, 'desktop');
    await page.goto(base);
    let current = await ready(page);
    check(current.answer.id === 'FROG' && current.size === 'S' && current.chest.dials.length === 4, `desktop: a first visit should open on the FROG teaching chest, got ${current.answer.id}`);
    check((await page.locator('.window .picture').textContent()) === '🐸', 'desktop: the Small chest should show its picture');
    check((await page.locator('.card').count()) === 0, 'desktop: no menu on the way in');
    await settled(page, '.chest');
    await page.screenshot({ path: `${shots}desktop-opening.png` });

    await typeWord(page, 'FORG');
    await page.keyboard.press('Enter');
    await wait(260);
    await page.screenshot({ path: `${shots}desktop-marks.png` });
    current = await phase(page, 'play');
    check(JSON.stringify(current.chest.gold) === '[0,3]' && current.chest.dials.join() === 'F,,,G' && current.chest.cursor === 1, `desktop: FORG should latch F and G gold, got ${JSON.stringify(current.chest)}`);
    const keyClasses = await page.evaluate(() => ['F', 'O', 'R', 'G'].map((letter) => document.querySelector(`.key[data-letter="${letter}"]`).className));
    check(keyClasses[0].includes('gold') && keyClasses[1].includes('blue') && keyClasses[2].includes('blue'), `desktop: the keys should keep their marks, got ${keyClasses}`);
    await typeWord(page, 'RO');
    await page.keyboard.press('Enter');
    await phase(page, 'reveal');
    await settled(page, '.reveal');
    await page.screenshot({ path: `${shots}desktop-reveal.png` });
    let save = await saved(page);
    check(save.shelf.en?.[0]?.id === 'FROG' && save.shelf.en[0].star === true, `desktop: FROG should be on the shelf with its ✦, got ${JSON.stringify(save.shelf)}`);
    await page.keyboard.press('Enter');
    current = await until(async () => (await state(page)).answer.id === 'FISH' && state(page), 4000, 'the second teaching chest');
    console.log('[desktop] FROG by keys: FORG latched F and G, the chest opened onto the shelf, FISH slid in');

    // Tab walks the toolbar in the design's order, and any letter returns focus to the lock.
    check((await focused(page)).startsWith('dial'), `desktop: the lock should have focus, had ${await focused(page)}`);
    const walk = [];
    for (let step = 0; step < 7; step++) {
      await page.keyboard.press('Tab');
      walk.push((await focused(page)).split('|')[1]);
    }
    const expected = ['Lantern: a little help', 'Set this chest aside for later', 'Chest with 4 dials', 'Chest with 5 dials', 'Chest with 6 dials', 'Shelf', 'Turn sound off'];
    check(JSON.stringify(walk) === JSON.stringify(expected), `desktop: Tab should walk ${expected}, walked ${walk}`);
    await page.keyboard.press('KeyA');
    check((await focused(page)).startsWith('dial'), 'desktop: a letter should return focus to the lock');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    current = await state(page);
    check(current.chest.lantern === 1 && current.chest.gold.includes(0) && current.chest.dials[0] === 'F', `desktop: the lantern should latch F, got ${JSON.stringify(current.chest)}`);

    // Pause by Esc: arrows reach the A-B-C keyboard, Enter flips it, Esc resumes.
    await page.keyboard.press('Escape');
    await settled(page, '.card-pause');
    await page.screenshot({ path: `${shots}desktop-pause.png` });
    for (let step = 0; step < 4; step++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    const abcRow = await page.evaluate(() => [...document.querySelector('.keyboard .row').querySelectorAll('.letter')].map((key) => key.dataset.letter).join(''));
    check(abcRow === 'ABCDEFGHIJ', `desktop: the A-B-C setting should order the keys, first row ${abcRow}`);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    check((await state(page)).overlay === null && (await focused(page)).startsWith('dial'), 'desktop: Esc should resume with focus on the lock');
    console.log('[desktop] Tab order, letter refocus, lantern, A-B-C keyboard and Esc, all by keys');

    // A Medium chest out of keys: the answer rolls in gold and goes to the back-later basket.
    for (let step = 0; step < 4; step++) await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    current = await until(async () => (await state(page)).size === 'M' && state(page), 3000, 'the Medium chest');
    check(await page.locator('.window.cloth').isVisible(), 'desktop: a Medium picture starts under a cloth');
    const medium = current.answer.id;
    for (let tryNumber = 0; tryNumber < 6; tryNumber++) await wrongTryByKeys(page, medium.includes('Q') ? 'X' : 'Q');
    current = await phase(page, 'reveal');
    save = await saved(page);
    check(save.later.some((entry) => entry.id === medium && entry.size === 'M' && entry.wait >= 5 && entry.wait <= 10), `desktop: ${medium} should wait 5–10 chests in the basket, got ${JSON.stringify(save.later)}`);
    check(!save.shelf.en.some((entry) => entry.id === medium), 'desktop: a revealed chest must not go on the shelf');
    await settled(page, '.reveal');
    await page.screenshot({ path: `${shots}desktop-out-of-keys.png` });
    await page.keyboard.press('Enter');
    await phase(page, 'play');
    console.log(`[desktop] ${medium} ran out of keys, showed its word and went to the back-later basket`);

    // Medium № 42 from the shelf's number pad, by keys.
    for (let step = 0; step < 6; step++) await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await settled(page, '.card-shelf');
    await page.keyboard.press('Digit4');
    await page.keyboard.press('Digit2');
    await page.screenshot({ path: `${shots}desktop-shelf.png` });
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    current = await until(async () => (await state(page)).answer.number === 42 && state(page), 3000, 'chest № 42');
    check(current.size === 'M' && current.overlay === null, `desktop: № 42 should open as a Medium chest, got ${current.size}`);
    for (let step = 0; step < 7; step++) await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    save = await saved(page);
    check(save.settings.muted === true, 'desktop: Enter on the mute button should save the mute');
    console.log('[desktop] Medium № 42 from the number pad, then mute, by keys');

    // Quitting loses nothing: a reload boots into the same chest exactly as it was.
    await page.keyboard.press(medium.includes('Q') ? 'KeyX' : 'KeyQ');
    await wrongTryByKeys(page, 'Z');
    await typeWord(page, 'AB');
    const before = (await state(page)).chest;
    await page.reload();
    const after = (await ready(page)).chest;
    check(JSON.stringify(before) === JSON.stringify(after), `desktop: the reload should restore the chest, ${JSON.stringify(before)} vs ${JSON.stringify(after)}`);

    // Six tries on a Small chest all stay on screen.
    await page.evaluate(() => document.querySelectorAll('.size')[0].click());
    await until(async () => (await state(page)).size === 'S', 2000, 'back to Small');
    for (let tryNumber = 0; tryNumber < 6; tryNumber++) await wrongTryByKeys(page, 'Q');
    check((await state(page)).chest.tries.length === 6 && (await triesOnScreen(page)), 'desktop: six tries should all stay on screen');
    await page.screenshot({ path: `${shots}desktop-six-tries.png` });
    console.log('[desktop] a reload resumed the chest exactly; six tries stayed on screen');
    await context.close();
  }

  // ---- 2. phone, real touch ----------------------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, locale: 'en-US' });
    const page = await context.newPage();
    watch(page, 'phone');
    await page.goto(base);
    await ready(page);
    await settled(page, '.chest');
    await page.screenshot({ path: `${shots}phone-opening.png` });
    const boxes = await page.evaluate(() => ({
      keys: [...document.querySelectorAll('.key.letter')].map((key) => key.getBoundingClientRect()).map((box) => [box.width, box.height]),
      toolbar: [...document.querySelectorAll('.toolbar button, .lantern, .set-aside')].map((node) => node.getBoundingClientRect()).map((box) => [box.width, box.height]),
      dials: [...document.querySelectorAll('.dial')].map((node) => node.getBoundingClientRect().width),
    }));
    check(boxes.keys.every(([width, height]) => width >= 30 && height >= 54), `phone: letter keys should be at least 30 × 54, got ${JSON.stringify(boxes.keys.slice(0, 3))}`);
    check(boxes.toolbar.every(([width, height]) => width >= 48 && height >= 48), `phone: toolbar buttons should be at least 48 px, got ${JSON.stringify(boxes.toolbar)}`);
    check(boxes.dials.every((width) => width >= 56), `phone: dials should be at least 56 px wide, got ${boxes.dials}`);
    const tapCentre = async (selector) => {
      const box = await page.locator(selector).first().boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    };
    for (const letter of 'FORG') await tapCentre(`.key[data-letter="${letter}"]`);
    await tapCentre('.key.turn');
    await wait(300);
    await page.screenshot({ path: `${shots}phone-marks.png` });
    await phase(page, 'play');
    // A tap on gold lets it go; a drag rolls a dial click by click.
    await tapCentre('.dial >> nth=0');
    let current = await state(page);
    check(!current.chest.gold.includes(0) && current.chest.dials[0] === 'F', `phone: a tap on gold should unlatch it, got ${JSON.stringify(current.chest)}`);
    const dial = await page.locator('.dial').nth(1).boundingBox();
    const cdp = await context.newCDPSession(page);
    const from = { x: dial.x + dial.width / 2, y: dial.y + dial.height / 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
    for (let step = 1; step <= 6; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x, y: from.y - step * 9 }] });
      await wait(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    current = await state(page);
    check(current.chest.dials[1] === 'B', `phone: a 54 px drag up should roll the empty dial two clicks to B, got ${current.chest.dials[1]}`);
    await tapCentre('.dial >> nth=1');
    for (const letter of 'RO') await tapCentre(`.key[data-letter="${letter}"]`);
    await tapCentre('.key.turn');
    await phase(page, 'reveal');
    await settled(page, '.reveal');
    await page.screenshot({ path: `${shots}phone-reveal.png` });
    await tapCentre('.reveal .next');
    await until(async () => (await state(page)).answer.id === 'FISH', 3000, 'FISH by tap');
    console.log('[phone] FROG by taps: a tap unlatched gold, a drag rolled a dial, the chest opened');
    for (let tryNumber = 0; tryNumber < 6; tryNumber++) {
      while (!(await state(page)).chest.dials.every(Boolean)) await tapCentre('.key[data-letter="Q"]');
      await tapCentre('.key.turn');
      await phase(page, 'play');
    }
    check(await triesOnScreen(page), 'phone: six tries should all stay on screen');
    await page.screenshot({ path: `${shots}phone-six-tries.png` });
    await tapCentre('.toolbar .round >> nth=2');
    await settled(page, '.card-pause');
    await page.screenshot({ path: `${shots}phone-pause.png` });
    await tapCentre('.card-pause .wide >> nth=1');
    await settled(page, '.card-shelf');
    await page.screenshot({ path: `${shots}phone-shelf.png` });
    await tapCentre('.card-shelf .primary');
    await until(async () => (await state(page)).overlay === null, 2000, 'back to the lock by tap');
    console.log('[phone] six tries on screen; pause and shelf by tap');
    await context.close();

    const landscape = await browser.newContext({ viewport: { width: 740, height: 360 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, locale: 'en-US' });
    const wide = await landscape.newPage();
    watch(wide, 'phone-landscape');
    await wide.goto(base);
    await ready(wide);
    await typeWord(wide, 'FISH');
    await wide.keyboard.press('Enter');
    await phase(wide, 'play');
    check(await triesOnScreen(wide), 'landscape: the try should be on screen');
    await wide.screenshot({ path: `${shots}phone-landscape.png` });
    await landscape.close();
  }

  // ---- 3 and 4. Korean jamo by event.code, Chinese pinyin -----------------------------------------
  for (const language of ['ko', 'zh']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 });
    await context.addInitScript((code) => localStorage.setItem('kidtopia:lang', code), language);
    const page = await context.newPage();
    watch(page, language);
    await page.goto(base);
    const current = await ready(page);
    if (language === 'ko') {
      check(current.answer.id === 'ㄴㅏㅁㅜ', `ko: the first chest should be 나무, got ${current.answer.word}`);
      // A Hangul IME rewrites event.key, so the lock reads the physical key (§10).
      await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Process', code: 'KeyS', bubbles: true })));
      for (const code of ['KeyK', 'KeyA']) await page.keyboard.press(code);
      await page.keyboard.press('Shift+KeyR');
      check((await state(page)).chest.dials[3] === 'ㄲ', `ko: Shift+R should dial ㄲ, got ${(await state(page)).chest.dials}`);
      await page.keyboard.press('Backspace');
      await page.keyboard.press('KeyN');
      check((await page.locator('.compose').textContent()) === '나무', `ko: the jamo should compose to 나무 above the lock, got ${await page.locator('.compose').textContent()}`);
      await page.screenshot({ path: `${shots}ko-compose.png` });
    } else {
      check(current.answer.id === 'XIGUA' && (await page.locator('.dial .glyph').first().textContent()) === '', 'zh: the first chest should be XIGUA');
      await typeWord(page, 'XIGUA');
      check((await page.locator('.dial .glyph').first().textContent()) === 'x', 'zh: pinyin dials are lowercase');
    }
    await page.keyboard.press('Enter');
    await phase(page, 'reveal');
    await settled(page, '.reveal');
    const spelling = await page.locator('.reveal .spelling').textContent();
    const pinyin = await page.locator('.reveal .pinyin').textContent();
    check(language === 'ko' ? spelling === '나무' : spelling === '西瓜' && pinyin === 'xīguā', `${language}: the reveal should show the real spelling, got ${spelling} ${pinyin}`);
    await page.screenshot({ path: `${shots}${language}-reveal.png` });
    console.log(`[${language}] ${spelling} ${pinyin} opened by keys${language === 'ko' ? ' (event.code, Shift and an IME Process key)' : ''}`);
    await context.close();
  }

  // ---- 5. inside the site's sandboxed iframe ----------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
    const page = await context.newPage();
    watch(page, 'iframe');
    await page.route('**/__host.html', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><body style="margin:0;background:#222"><iframe id="game" src="${base}?framed=1" style="border:0;width:1280px;height:720px"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals" allow="fullscreen; autoplay; gamepad"></iframe></body>`,
      }),
    );
    await page.goto(`${base}__host.html`);
    const frame = await until(() => page.frame({ url: (url) => url.href.includes('framed=1') }), 10000, 'game frame');
    await ready(frame);
    await page.locator('#game').click({ position: { x: 300, y: 200 } });
    await typeWord(page, 'FORG');
    await page.keyboard.press('Enter');
    await until(async () => (await state(frame)).chest.tries.length === 1, 3000, 'keys reach the framed game');
    const stored = await frame.evaluate(() => localStorage.getItem('letterlock:save'));
    check(stored?.includes('"FORG"'), `iframe: the try should be saved, got ${stored}`);
    await page.screenshot({ path: `${shots}iframe.png` });
    console.log('[iframe] boots, takes keys and saves inside the /play sandbox');
    await context.close();
  }

  // ---- 6. every string blanked ----------------------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en-US' });
    const page = await context.newPage();
    watch(page, 'blank');
    await page.goto(`${base}?blank=1`);
    await ready(page);
    await typeWord(page, 'FROG');
    await page.keyboard.press('Enter');
    await phase(page, 'reveal');
    await page.keyboard.press('Enter');
    await phase(page, 'play');
    await page.keyboard.press('Escape');
    await settled(page, '.card-pause');
    const report = await page.evaluate(() => ({
      // Letters on keys and dials, and the native language names, are content, not strings.
      labels: [...document.querySelectorAll('[aria-label]:not(.language)')].map((node) => node.getAttribute('aria-label')).filter((label) => label && !/^\p{L}$/u.test(label)),
      iconless: [...document.querySelectorAll('.toolbar button, .tool, .card button:not(.language)')].filter((node) => !node.querySelector('svg')).length,
      words: document.querySelector('.card-pause').textContent.replace(/English|Español|Deutsch|Português|Français|Norsk|한국어|中文|\s/g, ''),
    }));
    check(report.labels.length === 0, `blank: labels should be empty, found ${report.labels.slice(0, 5)}`);
    check(report.iconless === 0, `blank: ${report.iconless} controls have no icon`);
    check(report.words === '', `blank: the pause card should hold no words, found "${report.words}"`);
    await page.screenshot({ path: `${shots}blank-pause.png` });
    console.log('[blank] plays and pauses with every string blanked; every control keeps an icon');
    await context.close();
  }

  // ---- 7. a device that draws no emoji --------------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en-US' });
    await context.addInitScript(() => {
      const read = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function (...area) {
        const image = read.apply(this, area);
        image.data.fill(0);
        return image;
      };
    });
    const page = await context.newPage();
    watch(page, 'no-emoji');
    await page.goto(base);
    const current = await ready(page);
    check(!current.emojiDrawn && JSON.stringify(current.chest.gold) === '[0]' && current.chest.dials[0] === 'F', `no-emoji: the Small chest should latch its first letter, got ${JSON.stringify(current.chest)}`);
    console.log('[no-emoji] boxes instead of pictures: the Small chest latched its first letter');
    await context.close();
  }
} catch (error) {
  fail(error.message);
} finally {
  await browser.close().catch(() => {});
  server.kill('SIGKILL');
}

if (failures.length) {
  console.error(`\nsmoke: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log(`\nsmoke: OK (screenshots in ${shots})`);
