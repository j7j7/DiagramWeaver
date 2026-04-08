import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const raw = String(pkg.version ?? '').trim();
const parts = raw.split('.').map((s) => parseInt(s, 10));
if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
  throw new Error(`Invalid semver in package.json: ${JSON.stringify(pkg.version)}`);
}
const [major, minor, patch] = parts;
pkg.version = `${major}.${minor}.${patch + 1}`;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
