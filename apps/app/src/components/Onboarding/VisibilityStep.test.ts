import { describe, expect, it } from 'vitest';

import { parseParticipantNumber, validator } from './VisibilityStep';

describe('visibility validator', () => {
  it('accepts staying anonymous without a name', () => {
    expect(validator.safeParse({ mode: 'anonymous' }).success).toBe(true);
  });

  it('requires a name when the member shows their name', () => {
    expect(validator.safeParse({ mode: 'name' }).success).toBe(false);
    expect(validator.safeParse({ mode: 'name', fullName: '   ' }).success).toBe(
      false,
    );
    expect(
      validator.safeParse({ mode: 'name', fullName: 'Alex Chen' }).success,
    ).toBe(true);
  });

  it('rejects an unknown mode', () => {
    expect(validator.safeParse({ mode: 'ghost' }).success).toBe(false);
  });
});

describe('parseParticipantNumber', () => {
  it('reads the number from a trigger-assigned participant name', () => {
    expect(parseParticipantNumber('Participant 46')).toBe('46');
  });

  it('returns null for any other profile name', () => {
    expect(parseParticipantNumber('Alex Chen')).toBeNull();
    expect(parseParticipantNumber('Participant')).toBeNull();
    expect(parseParticipantNumber('')).toBeNull();
  });
});
