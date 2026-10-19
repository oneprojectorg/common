import { describe, expect, it } from 'vitest';

import { SMS_MAX_BODY_LENGTH, clipSmsText, splitSmsBody } from './text';

describe('clipSmsText', () => {
  it('given text within the limit, then it is returned whole', () => {
    expect(clipSmsText('short', 10)).toBe('short');
  });

  it('given text over the limit, then it is cut to the limit with a three-dot ellipsis', () => {
    expect(clipSmsText('a long sentence', 8)).toBe('a lon...');
    expect(clipSmsText('a long sentence', 8)).toHaveLength(8);
  });

  it('given text over the limit, then the clipped text stays in the GSM-7 basic set so Twilio keeps 160-character segments', () => {
    expect(clipSmsText('a long sentence', 8)).toMatch(/^[\x20-\x7E]*$/);
  });
});

describe('splitSmsBody', () => {
  const lines = Array.from(
    { length: 40 },
    (_, i) => `${i + 1}. ${'x'.repeat(90)}`,
  );

  it('given lines that fit one text, then one body carries the heading, every line and the footer', () => {
    expect(
      splitSmsBody({
        heading: 'Head:',
        lines: ['one', 'two'],
        footer: 'Foot.',
      }),
    ).toEqual(['Head:\none\ntwo\nFoot.']);
  });

  it('given more lines than one text holds, then every body fits, the heading opens the first, the footer closes the last, and each body is numbered', () => {
    const bodies = splitSmsBody({ heading: 'Head:', lines, footer: 'Foot.' });

    expect(bodies.length).toBeGreaterThan(1);
    bodies.forEach((body) => {
      expect(body.length).toBeLessThanOrEqual(SMS_MAX_BODY_LENGTH);
    });
    expect(bodies[0]!.startsWith(`Head: (1/${bodies.length})`)).toBe(true);
    expect(bodies.at(-1)!.endsWith('Foot.')).toBe(true);
    bodies.slice(0, -1).forEach((body) => {
      expect(body.endsWith('Foot.')).toBe(false);
    });
    expect(bodies[1]!.startsWith(`(2/${bodies.length})`)).toBe(true);
    expect(bodies.flatMap((body) => body.split('\n'))).toEqual(
      expect.arrayContaining(lines),
    );
  });

  it('given no lines, then the heading and footer still form one body', () => {
    expect(
      splitSmsBody({ heading: 'Head:', lines: [], footer: 'Foot.' }),
    ).toEqual(['Head:\nFoot.']);
  });
});
