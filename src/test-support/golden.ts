import * as fs from 'fs';
import * as path from 'path';

const GOLDEN_DIR = path.join(__dirname, '..', 'domain', 'export', '__golden__');

function goldenPath(name: string): string {
  return path.join(GOLDEN_DIR, /\.(md|csv)$/.test(name) ? name : `${name}.md`);
}

/**
 * Compares `actual` with the golden file of that name (`.md` unless the name ends in `.csv`).
 * A missing or different file fails; UPDATE_GOLDEN=1 rewrites it. Goldens hold synthetic values
 * only, and nothing is printed to the console.
 */
export function expectGolden(name: string, actual: string): void {
  const file = goldenPath(name);
  if (process.env.UPDATE_GOLDEN === '1') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, actual, 'utf8');
    return;
  }
  if (!fs.existsSync(file)) {
    throw new Error(`Golden file ${path.basename(file)} is missing; run with UPDATE_GOLDEN=1.`);
  }
  expect(actual).toBe(fs.readFileSync(file, 'utf8'));
}
