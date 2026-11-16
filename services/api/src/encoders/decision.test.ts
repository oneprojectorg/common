import { describe, expect, it } from 'vitest';

import { createInstanceInputSchema } from './decision';

describe('createInstanceInputSchema', () => {
  it('renames legacy phase fields and leaves the current ones alone', () => {
    const parsed = createInstanceInputSchema.parse({
      processId: '00000000-0000-4000-8000-000000000000',
      name: 'Legacy phases',
      instanceData: {
        phases: [
          {
            stateId: 'submission',
            plannedStartDate: '2026-01-01',
            plannedEndDate: '2026-01-31',
          },
          { phaseId: 'review', startDate: '2026-02-01', endDate: '2026-02-28' },
        ],
      },
    });

    expect(parsed.instanceData.phases).toMatchObject([
      { phaseId: 'submission', startDate: '2026-01-01', endDate: '2026-01-31' },
      { phaseId: 'review', startDate: '2026-02-01', endDate: '2026-02-28' },
    ]);
  });

  it('rejects a phase that is not an object', () => {
    expect(
      createInstanceInputSchema.safeParse({
        processId: '00000000-0000-4000-8000-000000000000',
        name: 'Bad phases',
        instanceData: { phases: ['submission'] },
      }).success,
    ).toBe(false);
  });
});
