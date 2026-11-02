import { describe, expect, it, vi } from 'vitest';

import { ValidationError } from '../../utils';
import { assertPhasesCanBeMinted } from './phaseHelpers';
import { MAX_PHASE_NAME_LENGTH } from './schemas/phaseName';

vi.mock('@op/db/client', () => ({ db: {} }));
vi.mock('../assert', () => ({ assertProfileAccess: vi.fn() }));

describe('assertPhasesCanBeMinted', () => {
  it('accepts distinct ids and names up to the maximum length', () => {
    expect(() =>
      assertPhasesCanBeMinted([
        { phaseId: 'submission', name: 'x'.repeat(MAX_PHASE_NAME_LENGTH) },
        { phaseId: 'voting' },
      ]),
    ).not.toThrow();
  });

  it.for([
    {
      label: 'a phase with no id',
      message: /A phase has no id/,
      phases: [{ phaseId: '', name: 'Submission' }],
    },
    {
      label: 'two phases with one id',
      message: /Two phases share the id "submission"/,
      phases: [{ phaseId: 'submission' }, { phaseId: 'submission' }],
    },
    {
      label: 'a name over the maximum length',
      message: /at most 256/,
      phases: [
        { phaseId: 'submission', name: 'x'.repeat(MAX_PHASE_NAME_LENGTH + 1) },
      ],
    },
  ])('refuses $label', ({ message, phases }) => {
    expect(() => assertPhasesCanBeMinted(phases)).toThrow(ValidationError);
    expect(() => assertPhasesCanBeMinted(phases)).toThrow(message);
  });
});
