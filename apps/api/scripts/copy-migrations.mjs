import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const sourceDir = resolve(scriptDir, '../src/db/migrations');
const targetDir = resolve(scriptDir, '../dist/db/migrations');

if (!existsSync(sourceDir)) {
  throw new Error(`Missing migrations source directory: ${sourceDir}`);
}

mkdirSync(targetDir, { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true });
