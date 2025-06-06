// @ts-nocheck
import fs from 'fs';
import path from 'path';

// 1. Gather all translation keys used in the codebase (t('...'))
// 2. Gather all keys defined in each locale file
// 3. Report missing keys for each locale

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);
const SRC_DIR = path.join(__dirname, '../src');
const DICT_DIR = path.join(__dirname, '../src/lib/i18n/dictionaries');
const LOCALES = ['en', 'es'];

function findUsedKeys(dir: string): Set<string> {
  const usedKeys = new Set<string>();
  function walk(current: string) {
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(current)) {
        walk(path.join(current, child));
      }
    } else if (current.endsWith('.ts') || current.endsWith('.tsx')) {
      const content = fs.readFileSync(current, 'utf8');
      // Match t('...') or t("...")
      const regex = /t\(['"]([^)'"]+)['"]\)/g;
      let match;
      while ((match = regex.exec(content))) {
        usedKeys.add(match[1]);
      }
    }
  }
  walk(dir);
  return usedKeys;
}

function loadLocaleKeys(locale: string): Set<string> {
  const file = path.join(DICT_DIR, `${locale}.json`);
  if (!fs.existsSync(file)) return new Set();
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return new Set(Object.keys(data));
}

function main() {
  const usedKeys = findUsedKeys(SRC_DIR);
  let hasMissing = false;
  for (const locale of LOCALES) {
    const localeKeys = loadLocaleKeys(locale);
    const missing = Array.from(usedKeys).filter((k) => !localeKeys.has(k));
    if (missing.length > 0) {
      hasMissing = true;
      console.log(`Missing keys in ${locale}.json:`);
      for (const key of missing) {
        console.log(`  ${key}`);
      }
    } else {
      console.log(`No missing keys in ${locale}.json.`);
    }
  }
  if (!hasMissing) {
    console.log('All locale files are up to date!');
  }
}

// ES module entry point
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
