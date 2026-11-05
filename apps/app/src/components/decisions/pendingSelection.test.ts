import { describe, expect, it } from 'vitest';

import { getPendingSelectionSourcePhase } from './pendingSelection';

const phases = [
  { phaseId: 'submission', name: 'Submission' },
  { phaseId: 'review', name: 'Review' },
  { phaseId: 'results', name: 'Results' },
];

describe('getPendingSelectionSourcePhase', () => {
  it('returns the phase before the current one while a selection is pending', () => {
    // Given a process that advanced past its review phase
    // When the inbound selection into the current phase is not confirmed
    const source = getPendingSelectionSourcePhase({
      phases,
      currentPhaseId: 'results',
      selectionsAreConfirmed: false,
    });

    // Then the pending selection shortlists from the review phase
    expect(source?.phaseId).toBe('review');
  });

  it('returns null once the selection is confirmed', () => {
    // Given the same process
    // When the admin has already confirmed the selection
    const source = getPendingSelectionSourcePhase({
      phases,
      currentPhaseId: 'results',
      selectionsAreConfirmed: true,
    });

    // Then no selection is pending, so no draft has a consumer
    expect(source).toBeNull();
  });

  it('treats a missing flag as pending, like DecisionStateRouter', () => {
    // Given a payload whose optional flag is absent
    // When the flag is undefined
    const source = getPendingSelectionSourcePhase({
      phases,
      currentPhaseId: 'results',
      selectionsAreConfirmed: undefined,
    });

    // Then the rule matches the router's falsy check
    expect(source?.phaseId).toBe('review');
  });

  it('returns null on the first phase', () => {
    // Given a process still in its first phase
    // When nothing precedes the current phase
    const source = getPendingSelectionSourcePhase({
      phases,
      currentPhaseId: 'submission',
      selectionsAreConfirmed: false,
    });

    // Then there is no phase to shortlist from
    expect(source).toBeNull();
  });

  it('returns null when the current phase is not in the list', () => {
    // Given an instance whose current state id matches no phase
    // When the current phase cannot be located
    const source = getPendingSelectionSourcePhase({
      phases,
      currentPhaseId: 'unknown',
      selectionsAreConfirmed: false,
    });

    // Then no source phase resolves
    expect(source).toBeNull();
  });

  it('returns null without phases', () => {
    // Given an instance with no phase list
    // When phases are null or undefined
    // Then no source phase resolves
    expect(
      getPendingSelectionSourcePhase({
        phases: undefined,
        currentPhaseId: 'results',
        selectionsAreConfirmed: false,
      }),
    ).toBeNull();
    expect(
      getPendingSelectionSourcePhase({
        phases: null,
        currentPhaseId: null,
        selectionsAreConfirmed: false,
      }),
    ).toBeNull();
  });
});
