// The build's gates (design §9, §12; SHIP-CHECKLIST §1–2), run last by `npm run build`:
//
//   1. Every installed dependency carries a recognised free/open-source license.
//   2. Every word list records where it came from (design §12): each was written by hand for
//      Letterlock, so its source is first-party, and a list with no recorded source fails.
//   3. The game ships ZERO asset files: the loft and chests are CSS gradients, every icon an
//      inline SVG, every picture the device's own emoji, every sound synthesized. Scans what can
//      reach a player — src/, public/, scripts/, index.html and dist/ — never node_modules/.
//   4. The built output contains no live external URL (no CDN, fonts or telemetry). Inert
//      occurrences (license comments, minified error URLs) are allowlisted with a reason.
//   5. The whole of dist/ stays under the design's 2 MiB byte budget (§12).
//
//   node scripts/check-licenses.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_BYTES = 2 * 1024 * 1024;

// The source of every word list (§12, §B). None was downloaded or generated: a native read
// before release is still the owner's open item (§15.5), recorded in VERIFICATION.md.
const WORD_LIST_SOURCES = Object.fromEntries(
  ['en', 'es', 'de', 'pt', 'fr', 'no', 'ko', 'zh'].map((language) => [language, 'hand-written for Letterlock, 2026-11 (first-party, PolyForm Noncommercial 1.0.0 with the game)']),
);

// MPL-2.0 is accepted only because lightningcss (Vite's CSS minifier) is a build tool:
// nothing of it ships to players. There are no runtime dependencies.
const FREE_LICENSES = [/^MIT\b/i, /^ISC\b/i, /^BSD-\d/i, /^Apache-2\.0/i, /^MPL-2\.0/i, /^CC0-1\.0/i, /^Unlicense$/i, /^0BSD$/i, /^BlueOak-1\.0\.0/i];

const ASSET_EXTENSIONS = new Set(
  '.glb .gltf .fbx .obj .dae .blend .stl .ply .3ds .png .jpg .jpeg .gif .webp .avif .bmp .tga .ktx .ktx2 .basis .dds .hdr .exr .tif .tiff .mp3 .wav .ogg .m4a .flac .aac .opus .mid .midi .ttf .otf .woff .woff2 .eot .mp4 .webm .mov .svg'.split(' '),
);

// Every http(s):// in dist/ that is provably inert, each with its reason. Prove any new one
// is never fetched before adding it here.
const INERT_URLS = [{ prefix: 'http://www.w3.org', reason: 'the XML namespace identifier of the inline favicon SVG, not a load' }];

const failures = [];

function walk(directory, onFile) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') walk(path, onFile);
    else if (entry.isFile()) onFile(path);
  }
}

// ---- 1. dependency licenses --------------------------------------------------------
if (!existsSync('node_modules')) {
  failures.push('node_modules/ missing: run `npm ci` before the license gate');
} else {
  const packageDirectories = readdirSync('node_modules').flatMap((name) =>
    name.startsWith('@') ? readdirSync(join('node_modules', name)).map((scoped) => join(name, scoped)) : name.startsWith('.') ? [] : [name],
  );
  let checked = 0;
  for (const name of packageDirectories) {
    const manifestPath = join('node_modules', name, 'package.json');
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const license = typeof manifest.license === 'string' ? manifest.license : manifest.license?.type;
    checked++;
    if (!license || !FREE_LICENSES.some((pattern) => pattern.test(license))) {
      failures.push(`dependency "${name}" license is not recognised as free: ${license ?? '(none)'}`);
    }
  }
  console.log(`license gate: ${checked} dependencies checked`);
}

// ---- 2. word list sources ----------------------------------------------------------
const listDirectories = readdirSync('src/data/words');
for (const language of listDirectories) {
  if (!WORD_LIST_SOURCES[language]) failures.push(`word list "${language}" has no recorded source`);
  else console.log(`word list ${language}: ${WORD_LIST_SOURCES[language]}`);
}
for (const language of Object.keys(WORD_LIST_SOURCES)) {
  if (!listDirectories.includes(language)) failures.push(`word list "${language}" is missing from src/data/words/`);
}

// ---- 3. zero asset files -----------------------------------------------------------
let scanned = 0;
const onSourceFile = (path) => {
  scanned++;
  if (ASSET_EXTENSIONS.has(extname(path).toLowerCase())) failures.push(`asset file present (§9 zero-asset rule): ${path}`);
};
for (const directory of ['src', 'public', 'scripts', 'dist']) if (existsSync(directory)) walk(directory, onSourceFile);
onSourceFile('index.html');
console.log(`asset gate: ${scanned} files scanned`);

// ---- 4 and 5. no live URLs in dist/, and the byte budget ---------------------------
if (!existsSync('dist')) {
  failures.push('dist/ missing: the network and byte gates need a build');
} else {
  let rawBytes = 0;
  let gzipBytes = 0;
  walk('dist', (path) => {
    const content = readFileSync(path);
    rawBytes += statSync(path).size;
    gzipBytes += gzipSync(content).length;
    if (!['.js', '.html', '.css', '.json'].includes(extname(path))) return;
    for (const url of content.toString('utf8').match(/https?:\/\/[^\s"'`)\\]+/g) ?? []) {
      if (!INERT_URLS.some((inert) => url.startsWith(inert.prefix))) failures.push(`live external URL in built output: ${url} (${path})`);
    }
  });
  console.log(`network gate: dist/ scanned for external URLs`);
  console.log(`byte budget: ${(rawBytes / 1024).toFixed(1)} KiB raw, ${(gzipBytes / 1024).toFixed(1)} KiB gzip (limit ${BUDGET_BYTES / 1024} KiB raw)`);
  if (rawBytes >= BUDGET_BYTES) failures.push(`dist/ is ${rawBytes} bytes, at or above the ${BUDGET_BYTES}-byte budget`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log('all gates passed');
