// Package the existing, pure legacy decoder; never duplicate the storage codec.
import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const target = new URL('./shared/', import.meta.url);
await mkdir(target, { recursive: true });
for (const file of ['cloud-chunks.mjs', 'migration-backups.mjs']) {
  await copyFile(new URL('../src/storage/' + file, import.meta.url), new URL(file, target));
}
console.log('Bestaande opslagdecoder verpakt in ' + fileURLToPath(target));
