/**
 * Generates a manifest of quiz cover images so the admin UI can offer a picker.
 *
 * A browser can't list a static folder at runtime, so we scan
 * `src/assets/quiz-images/` at build/dev time and write `manifest.json` next to
 * the images. The quiz form fetches that file and renders the gallery.
 *
 * Run manually with `npm run assets:manifest`, or automatically via the
 * `prestart` / `prebuild` hooks. Add an image to the folder, re-run, done.
 */
const fs = require('fs');
const path = require('path');

const IMAGE_DIR = path.join(__dirname, '..', 'src', 'assets', 'quiz-images');
const MANIFEST = path.join(IMAGE_DIR, 'manifest.json');
const RUNTIME_PREFIX = 'assets/quiz-images';
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif']);

fs.mkdirSync(IMAGE_DIR, { recursive: true });

const images = fs
  .readdirSync(IMAGE_DIR)
  .filter((name) => IMAGE_EXT.has(path.extname(name).toLowerCase()))
  .sort((a, b) => a.localeCompare(b))
  .map((name) => `${RUNTIME_PREFIX}/${name}`);

fs.writeFileSync(MANIFEST, JSON.stringify(images, null, 2) + '\n');

console.log(`[assets:manifest] wrote ${images.length} image(s) to ${path.relative(process.cwd(), MANIFEST)}`);
