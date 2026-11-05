import { describe, expect, it, vi } from 'vitest';

import { ValidationError } from '../../utils';
import { assertPhaseNamesFit, assertPhasesCanBeMinted } from './phaseHelpers';
import { MAX_PHASE_NAME_LENGTH } from './schemas/phaseName';

vi.mock('@op/db/client', () => ({ db: {} }));
vi.mock('../assert', () => ({ assertProfileAccess: vi.fn() }));

describe('assertPhasesCanBeMinted', () => {
  it('accepts distinct ids', () => {
    expect(() =>
      assertPhasesCanBeMinted([
        { phaseId: 'submission', name: 'Submission' },
        { phaseId: 'voting' },
      ]),
    ).not.toThrow();
  });

  it.for([
    {
      label: 'a phase with no id',
      message: /There is a phase with no id/,
      phases: [{ phaseId: '', name: 'Submission' }],
    },
    {
      label: 'two phases with one id',
      message: /There are two phases with the id "submission"/,
      phases: [{ phaseId: 'submission' }, { phaseId: 'submission' }],
    },
  ])('refuses $label', ({ message, phases }) => {
    expect(() => assertPhasesCanBeMinted(phases)).toThrow(ValidationError);
    expect(() => assertPhasesCanBeMinted(phases)).toThrow(message);
  });
});

describe('assertPhaseNamesFit', () => {
  it('accepts a name of exactly the maximum length', () => {
    expect(() =>
      assertPhaseNamesFit([
        { phaseId: 'submission', name: 'x'.repeat(MAX_PHASE_NAME_LENGTH) },
      ]),
    ).not.toThrow();
  });

  it('refuses a name over the maximum length', () => {
    const phases = [
      { phaseId: 'submission', name: 'x'.repeat(MAX_PHASE_NAME_LENGTH + 1) },
    ];
    expect(() => assertPhaseNamesFit(phases)).toThrow(ValidationError);
    expect(() => assertPhaseNamesFit(phases)).toThrow(/at most 256/);
  });
});
