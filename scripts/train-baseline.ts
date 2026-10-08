/**
 * Trains the baseline hoax classifier (src/lib/baseline.ts) on the published
 * fact-checks and writes data/models/baseline.json, which the detector uses
 * for every public check unless an external model is configured.
 *
 *   npm run train:baseline                          train, print the metrics, write the model
 *   npm run train:baseline -- --dry                 train and print the metrics, write nothing
 *   npm run train:baseline -- --compare             score both text variants, write nothing
 *   npm run train:baseline -- --variant=claim+explanation   train on the other variant
 *   npm run train:baseline -- --seed=7              another holdout split
 *
 * Reads data/hoax.db (or DATABASE_PATH); the articles table is only read. The
 * only file written is the model (BASELINE_MODEL_PATH overrides the path).
 */

import fs from "node:fs";
import { getDb } from "../src/lib/db.ts";
import { ARCHIVE_LANGS, baselineModelPath, CLASSES, TEXT_VARIANTS, trainBaseline, type BaselineMetrics, type TextVariant } from "../src/lib/baseline.ts";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const COMPARE = args.includes("--compare");
const variantArg = args.find((a) => a.startsWith("--variant="))?.slice("--variant=".length);
const seedArg = args.find((a) => a.startsWith("--seed="))?.slice("--seed=".length);

if (variantArg && !TEXT_VARIANTS.includes(variantArg as TextVariant)) {
  console.error(`Unknown variant "${variantArg}". Use one of: ${TEXT_VARIANTS.join(", ")}.`);
  process.exit(1);
}
const seed = seedArg ? Number(seedArg) : undefined;
if (seedArg && !Number.isInteger(seed)) {
  console.error(`--seed must be an integer, got "${seedArg}".`);
  process.exit(1);
}

const n = (v: number) => v.toLocaleString("en-US");
const pct = (v: number) => (v * 100).toFixed(1).padStart(5);
const cell = (s: string | number, w: number) => String(s).padStart(w);

function printMetrics(m: BaselineMetrics): void {
  console.log(`\nBaseline classifier, text variant "${m.textVariant}"`);
  console.log(`  training docs ${n(m.docs)}   holdout ${n(m.holdout)}   features ${n(m.features)}   temperature ${m.temperature}   ${(m.trainMs / 1000).toFixed(1)} s`);
  console.log(`  accuracy ${pct(m.accuracy)}%   macro-F1 ${pct(m.macroF1)}%\n`);
  console.log(`  ${"class".padEnd(12)} ${cell("precision", 9)} ${cell("recall", 7)} ${cell("F1", 6)} ${cell("support", 8)}`);
  for (const c of CLASSES) {
    const p = m.perClass[c];
    console.log(`  ${c.padEnd(12)} ${cell(pct(p.precision), 9)} ${cell(pct(p.recall), 7)} ${cell(pct(p.f1), 6)} ${cell(n(p.support), 8)}`);
  }
  console.log(`\n  confusion (rows = actual, columns = predicted)`);
  console.log(`  ${"".padEnd(12)} ${CLASSES.map((c) => cell(c, 11)).join(" ")}`);
  m.confusion.forEach((row, i) => console.log(`  ${CLASSES[i].padEnd(12)} ${row.map((v) => cell(n(v), 11)).join(" ")}`));
  if (m.perLanguage) {
    console.log(`
  per language (holdout rows per class in brackets)`);
    console.log(`  ${"language".padEnd(12)} ${cell("holdout", 8)} ${cell("accuracy", 9)} ${cell("macro-F1", 9)} ${CLASSES.map((c) => cell(`${c} F1`, 17)).join(" ")}`);
    for (const lang of ARCHIVE_LANGS) {
      const l = m.perLanguage[lang];
      const f1 = CLASSES.map((c) => cell(`${pct(l.perClass[c].f1)} (${n(l.perClass[c].support)})`, 17)).join(" ");
      console.log(`  ${lang.padEnd(12)} ${cell(n(l.holdout), 8)} ${cell(pct(l.accuracy), 9)} ${cell(pct(l.macroF1), 9)} ${f1}`);
    }
  }
}

const db = getDb();
const { n: published } = db.prepare("SELECT COUNT(*) AS n FROM articles WHERE published = 1").get() as { n: number };
console.log(`published fact-checks: ${n(published)}`);

if (COMPARE) {
  for (const variant of TEXT_VARIANTS) printMetrics(trainBaseline(db, { variant, seed, write: false }));
  console.log("\n(comparison only, nothing written)");
} else {
  const metrics = trainBaseline(db, { variant: variantArg as TextVariant | undefined, seed, write: !DRY });
  printMetrics(metrics);
  if (DRY) console.log("\n(dry run, nothing written)");
  else {
    const file = baselineModelPath();
    console.log(`\nwrote ${file} (${(fs.statSync(file).size / 1024 / 1024).toFixed(1)} MB)`);
  }
}
