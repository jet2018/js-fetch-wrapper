import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cjsPkg = join(root, 'dist', 'cjs', 'package.json');
mkdirSync(dirname(cjsPkg), { recursive: true });
writeFileSync(cjsPkg, JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
