import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, '..', 'src', 'lib', 'build-version.json');
const raw = fs.readFileSync(file, 'utf8');
const data = JSON.parse(raw);
const next = (typeof data.build === 'number' && Number.isFinite(data.build) ? data.build : 0) + 1;
fs.writeFileSync(file, `${JSON.stringify({ build: next }, null, 2)}\n`, 'utf8');
