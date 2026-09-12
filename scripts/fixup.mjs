// scripts/fixup.mjs
// Marks each output tree with its module system so Node resolves both correctly.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
writeFileSync(join(dist, 'esm', 'package.json'), '{"type":"module"}\n');
writeFileSync(join(dist, 'cjs', 'package.json'), '{"type":"commonjs"}\n');
process.stdout.write('wrote dist/{esm,cjs}/package.json\n');
