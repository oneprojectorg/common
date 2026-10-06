import assert from 'node:assert/strict';
import { test } from 'node:test';

import { withBaseScores } from './fallow-crap.mjs';

const row = (path, crap) => ({ path, crap, name: 'fn', line: 1 });

test('a file that rose from under 30 to 30 or over is a crossing', () => {
  const [result] = withBaseScores({
    scored: [row('a.ts', 30)],
    baseFiles: { 'a.ts': 29.9 },
    moved: new Set(),
  });
  assert.equal(result.before, 29.9);
  assert.equal(result.crossed, true);
});

test('a file already over 30 at the base is not a crossing', () => {
  const [result] = withBaseScores({
    scored: [row('a.ts', 56)],
    baseFiles: { 'a.ts': 40 },
    moved: new Set(),
  });
  assert.equal(result.crossed, false);
});

test('a file with no base score gets no before and no crossing', () => {
  const [result] = withBaseScores({
    scored: [row('new.ts', 56)],
    baseFiles: {},
    moved: new Set(),
  });
  assert.equal(result.before, null);
  assert.equal(result.crossed, false);
});

test('a file edited between the scored commit and the merge base gets no before', () => {
  const [result] = withBaseScores({
    scored: [row('a.ts', 56)],
    baseFiles: { 'a.ts': 12 },
    moved: new Set(['a.ts']),
  });
  assert.equal(result.before, null);
  assert.equal(result.crossed, false);
});
