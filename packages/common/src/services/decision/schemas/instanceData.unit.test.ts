import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../../utils';
import { simpleVoting } from './definitions';
import { createInstanceDataFromTemplate, isLastPhase } from './instanceData';

describe('isLastPhase', () => {
  it('returns true when currentStateId matches the last phase', () => {
    const phases = [{ phaseId: 'a' }, { phaseId: 'b' }, { phaseId: 'c' }];
    expect(isLastPhase('c', phases)).toBe(true);
  });

  it('returns false when currentStateId matches a non-last phase', () => {
    const phases = [{ phaseId: 'a' }, { phaseId: 'b' }, { phaseId: 'c' }];
    expect(isLastPhase('a', phases)).toBe(false);
    expect(isLastPhase('b', phases)).toBe(false);
  });

  it('returns true for a single-phase array when matched', () => {
    expect(isLastPhase('only', [{ phaseId: 'only' }])).toBe(true);
  });

  it('returns false when currentStateId does not match any phase', () => {
    const phases = [{ phaseId: 'a' }, { phaseId: 'b' }];
    expect(isLastPhase('missing', phases)).toBe(false);
  });

  it('returns false for null currentStateId', () => {
    expect(isLastPhase(null, [{ phaseId: 'a' }])).toBe(false);
  });

  it('returns false for undefined currentStateId', () => {
    expect(isLastPhase(undefined, [{ phaseId: 'a' }])).toBe(false);
  });

  it('returns false for empty phases array', () => {
    expect(isLastPhase('a', [])).toBe(false);
  });
});

describe('createInstanceDataFromTemplate settings', () => {
  it('copies settings that match the template phase schema', () => {
    const data = createInstanceDataFromTemplate({
      template: simpleVoting,
      phaseOverrides: [
        { phaseId: 'voting', settings: { maxVotesPerMember: 3, budget: 10 } },
      ],
    });

    expect(data.phases.find((p) => p.phaseId === 'voting')?.settings).toEqual({
      maxVotesPerMember: 3,
      budget: 10,
    });
  });

  it('rejects settings that break the template phase schema', () => {
    const create = () =>
      createInstanceDataFromTemplate({
        template: simpleVoting,
        phaseOverrides: [{ phaseId: 'voting', settings: { budget: -1 } }],
      });

    expect(create).toThrow(ValidationError);
    expect(create).toThrow('Invalid settings for phase "voting"');
  });
});
