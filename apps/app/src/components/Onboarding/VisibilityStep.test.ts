import { describe, expect, it } from 'vitest';

import {
  MAX_FULL_NAME_LENGTH,
  fullNameIssue,
  parseParticipantNumber,
  validator,
} from './VisibilityStep';

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

  it('rejects a name longer than the profile limit', () => {
    const tooLong = 'a'.repeat(MAX_FULL_NAME_LENGTH + 1);
    expect(
      validator.safeParse({ mode: 'name', fullName: tooLong }).success,
    ).toBe(false);
  });
});

describe('fullNameIssue', () => {
  it('requires a non-blank name', () => {
    expect(fullNameIssue('')).toBe('required');
    expect(fullNameIssue('   ')).toBe('required');
  });

  it('rejects a name over the limit before anything is saved', () => {
    expect(fullNameIssue('a'.repeat(MAX_FULL_NAME_LENGTH + 1))).toBe('tooLong');
  });

  it('accepts a name at the limit', () => {
    expect(fullNameIssue('a'.repeat(MAX_FULL_NAME_LENGTH))).toBeNull();
    expect(fullNameIssue('Alex Chen')).toBeNull();
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
