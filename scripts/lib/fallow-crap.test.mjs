import assert from 'node:assert/strict';
import { test } from 'node:test';

import { affectsCoverage, withBaseScores } from './fallow-crap.mjs';

const row = (path, crap) => ({ path, crap, name: 'fn', line: 1 });

test('a file that rose from under 30 to 30 or over is a crossing', () => {
  const [result] = withBaseScores({
    scored: [row('a.ts', 30)],
    baseFiles: { 'a.ts': 29.9 },
  });
  assert.equal(result.before, 29.9);
  assert.equal(result.crossed, true);
});

test('a file already over 30 at the base is not a crossing', () => {
  const [result] = withBaseScores({
    scored: [row('a.ts', 56)],
    baseFiles: { 'a.ts': 40 },
  });
  assert.equal(result.crossed, false);
});

test('a file with no base score gets no before and no crossing', () => {
  const [result] = withBaseScores({
    scored: [row('new.ts', 56)],
    baseFiles: {},
  });
  assert.equal(result.before, null);
  assert.equal(result.crossed, false);
});

test('only prose and CI config leave coverage alone', () => {
  assert.equal(affectsCoverage('docs/adr/0001.md'), false);
  assert.equal(affectsCoverage('packages/common/README.md'), false);
  assert.equal(affectsCoverage('.github/workflows/tests.yml'), false);
  // A test edited on dev moves files it never names.
  assert.equal(affectsCoverage('services/api/src/routers/foo.test.ts'), true);
  assert.equal(affectsCoverage('packages/common/src/services/x.ts'), true);
  assert.equal(affectsCoverage('pnpm-lock.yaml'), true);
});
