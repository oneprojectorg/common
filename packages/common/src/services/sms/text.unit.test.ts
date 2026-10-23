import { describe, expect, it } from 'vitest';

import { SMS_MAX_BODY_LENGTH, clipSmsText, splitSmsBody } from './text';

describe('clipSmsText', () => {
  it('given text within the limit, then it is returned whole', () => {
    expect(clipSmsText('short', 10)).toBe('short');
  });

  it('given text over the limit, then it is cut to the limit with a three-dot ellipsis that stays in the GSM-7 basic set', () => {
    const clipped = clipSmsText('a long sentence', 8);

    expect(clipped).toBe('a lon...');
    expect(clipped).toHaveLength(8);
    expect(clipped).toMatch(/^[\x20-\x7E]*$/);
  });

  it('given an emoji that straddles the cut, then the cut moves before it so no half character is sent', () => {
    const clipped = clipSmsText('abcdef🎉ghij', 10);

    expect(clipped).toBe('abcdef...');
    expect(clipped).not.toMatch(/\p{Surrogate}/u);
  });

  it('given an emoji that fits before the cut, then it is kept whole and the limit still counts it as two units', () => {
    const clipped = clipSmsText('ab🎉cdefghij', 10);

    expect(clipped).toBe('ab🎉cde...');
    expect(clipped).toHaveLength(10);
  });

  it('given a single emoji within the limit, then it is returned whole, not dropped', () => {
    expect(clipSmsText('🎉', 2)).toBe('🎉');
    expect(clipSmsText('🎉', 4)).toBe('🎉');
  });

  it('given text made only of emoji and room for one, then one whole emoji is kept before the ellipsis', () => {
    const clipped = clipSmsText('🎉🎉🎉🎉', 5);

    expect(clipped).toBe('🎉...');
    expect(clipped).toHaveLength(5);
  });

  it('given text made only of emoji and room for less than one, then only the ellipsis is sent, never half a character', () => {
    const clipped = clipSmsText('🎉🎉🎉', 4);

    expect(clipped).toBe('...');
    expect(clipped).not.toMatch(/\p{Surrogate}/u);
  });

  it.each([
    ['ab🎉cdefghij', 10],
    ['🎉🎉🎉🎉🎉', 7],
    ['a🎉b🎉c🎉d', 6],
    ['abcdef🎉ghij', 10],
  ])(
    'given %j clipped to %i, then the result fits the limit in UTF-16 units and holds no half character',
    (text, max) => {
      const clipped = clipSmsText(text, max);

      expect(clipped.length).toBeLessThanOrEqual(max);
      expect(clipped).not.toMatch(/\p{Surrogate}/u);
    },
  );
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

describe('splitSmsBody with one line longer than a text', () => {
  it('given a single line of 4000 characters, then it is cut at word boundaries into numbered texts that each fit', () => {
    const line = Array.from({ length: 500 }, (_, i) => `word${i}`).join(' ');

    const bodies = splitSmsBody({ lines: [line] });

    expect(bodies.length).toBeGreaterThan(1);
    for (const body of bodies) {
      expect(body.length).toBeLessThanOrEqual(1600);
      expect(body).toMatch(/^\(\d+\/\d+\)\n/);
    }
    expect(bodies.map((b) => b.replace(/^\(\d+\/\d+\)\n/, '')).join(' ')).toBe(
      line,
    );
  });

  it('given a single word longer than a text, then it is hard-cut so no text exceeds the limit', () => {
    const bodies = splitSmsBody({ lines: ['x'.repeat(3300)] });

    expect(bodies).toHaveLength(3);
    for (const body of bodies) {
      expect(body.length).toBeLessThanOrEqual(1600);
    }
  });
});
