import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { decodeCursorIfValid, encodeCursor } from './db';

const schema = z.object({ value: z.string(), tiebreaker: z.string().uuid() });

describe('decodeCursorIfValid', () => {
  it('returns the parsed cursor when it matches the schema', () => {
    const cursor = {
      value: 'Beatrice',
      tiebreaker: '00000000-0000-4000-8000-0000000000b0',
    };

    expect(decodeCursorIfValid(encodeCursor(cursor), schema)).toEqual(cursor);
  });

  it('discards a cursor whose shape predates the current schema', () => {
    // A caller that changed its cursor shape rewinds to the first page rather
    // than failing requests from clients mid-scroll across the deploy.
    const stale = encodeCursor({ value: 'Beatrice', tiebreaker: 'b@x.test' });

    expect(decodeCursorIfValid(stale, schema)).toBeUndefined();
  });

  it('throws on input that is not a cursor at all', () => {
    expect(() => decodeCursorIfValid('invalid-cursor', schema)).toThrow(
      'Invalid cursor',
    );
  });
});
