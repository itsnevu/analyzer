/**
 * Puts the in-browser screenshot reader (tesseract.js) under public/ocr/, so
 * the site serves it itself: no third-party CDN, and screenshots never leave
 * the visitor's device. Runs before `dev` and `build`; does nothing when the
 * files are already there.
 *
 *   public/ocr/worker.min.js             from node_modules/tesseract.js
 *   public/ocr/tesseract-core-*.wasm.js  from node_modules/tesseract.js-core
 *   public/ocr/lang/{ind,eng}.traineddata.gz   downloaded once (about 4 MB)
 */

import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "ocr");
const LANG_DIR = path.join(OUT, "lang");
const LANGS = ["ind", "eng"];
const CORE_FILES = ["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"];

fs.mkdirSync(LANG_DIR, { recursive: true });

function copyIfChanged(from: string, to: string) {
  if (fs.existsSync(to) && fs.statSync(to).size === fs.statSync(from).size) return false;
  fs.copyFileSync(from, to);
  return true;
}

let copied = 0;
copied += Number(copyIfChanged(path.join("node_modules", "tesseract.js", "dist", "worker.min.js"), path.join(OUT, "worker.min.js")));
for (const f of CORE_FILES) copied += Number(copyIfChanged(path.join("node_modules", "tesseract.js-core", f), path.join(OUT, f)));

let downloaded = 0;
for (const lang of LANGS) {
  const file = path.join(LANG_DIR, `${lang}.traineddata.gz`);
  if (fs.existsSync(file) && fs.statSync(file).size > 100_000) continue;
  const url = `https://cdn.jsdelivr.net/npm/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    downloaded++;
  } catch (err) {
    // Not fatal: the site works without it, only "read a screenshot" will fail.
    console.warn(`[prepare-ocr] could not download ${lang} language data (${String(err)}); screenshot reading will not work until it is present.`);
  }
}

if (copied || downloaded) console.log(`[prepare-ocr] public/ocr ready (${copied} files copied, ${downloaded} languages downloaded)`);
