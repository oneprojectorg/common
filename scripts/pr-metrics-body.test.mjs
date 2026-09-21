// Run with: node --test scripts/pr-metrics-body.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { END, START, splice } from './pr-metrics-body.mjs';

const block = (line) => `${START}\n${line}\n${END}`;

test('appends the block after one blank line when the body has none', () => {
  assert.equal(
    splice('One paragraph.\n\nAsana: https://x\n', 'metrics v1'),
    `One paragraph.\n\nAsana: https://x\n\n${block('metrics v1')}\n`,
  );
});

test('treats a missing body as empty', () => {
  assert.equal(splice(null, 'metrics v1'), `${block('metrics v1')}\n`);
  assert.equal(splice('', 'metrics v1'), `${block('metrics v1')}\n`);
});

test('replaces the block in place on the next run', () => {
  const first = splice('Prose.\n', 'metrics v1');
  const second = splice(first, 'metrics v2');
  assert.equal(second, `Prose.\n\n${block('metrics v2')}\n`);
  assert.equal(second.split(START).length, 2, 'exactly one block');
});

test('keeps prose written below the block', () => {
  const body = `Prose.\n\n${block('metrics v1')}\n\nA reviewer note.\n`;
  assert.equal(
    splice(body, 'metrics v2'),
    `Prose.\n\n${block('metrics v2')}\n\nA reviewer note.\n`,
  );
});

test('appends when the markers are out of order', () => {
  const body = `Prose.\n\n${END}\n${START}\n`;
  assert.equal(
    splice(body, 'metrics v1'),
    `Prose.\n\n${END}\n${START}\n\n${block('metrics v1')}\n`,
  );
});

test('trims the line so the markers sit on their own lines', () => {
  assert.equal(splice('', '  metrics v1\n'), `${block('metrics v1')}\n`);
});
