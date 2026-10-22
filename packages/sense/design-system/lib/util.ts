import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const DESIGN_SYSTEM_DIR = resolve(HERE, '..');
export const SENSE_DIR = resolve(DESIGN_SYSTEM_DIR, '..');
export const REPO_DIR = resolve(SENSE_DIR, '../..');
export const STYLES_DIR = resolve(REPO_DIR, 'packages/styles');
export const CONTENT_DIR = resolve(DESIGN_SYSTEM_DIR, 'content');

export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStringRecord(
  value: unknown,
): value is Record<string, string> {
  return (
    isRecord(value) && Object.values(value).every((v) => typeof v === 'string')
  );
}

export function log(message: string) {
  process.stdout.write(`${message}\n`);
}

export function writeFile(path: string, contents: string | Uint8Array) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}
