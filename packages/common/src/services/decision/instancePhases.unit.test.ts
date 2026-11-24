import { describe, expect, it, vi } from 'vitest';

import type { ProcessPhaseWithProfile } from './phaseHelpers';

vi.mock('@op/db/client', () => ({
  db: {},
  asc: () => undefined,
  eq: () => undefined,
  inArray: () => undefined,
}));

const { attachPhaseRows, toPhasesWithRowIds, withoutRowId } =
  await import('./instancePhases');

const blobPhases = [
  { phaseId: 'submission', name: 'Blob submission', startDate: '2026-01-01' },
  { phaseId: 'voting', name: 'Blob voting' },
];

const instance = {
  id: 'instance-1',
  instanceData: { phases: blobPhases },
};

const rows: ProcessPhaseWithProfile[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    profileId: 'profile-1',
    sortOrder: 0,
    data: { phaseId: 'submission', startDate: '2026-02-01' },
    name: 'Row submission',
    slug: 'submission-slug',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    profileId: 'profile-2',
    sortOrder: 1,
    data: { description: 'No stored phaseId' },
    name: 'Row review',
    slug: 'review-slug',
  },
];

describe('toPhasesWithRowIds', () => {
  it('builds each phase from its row and keeps the row id, in row order', () => {
    expect(toPhasesWithRowIds({ instance, phases: rows })).toEqual([
      {
        id: '00000000-0000-4000-8000-000000000001',
        phaseId: 'submission',
        name: 'Row submission',
        startDate: '2026-02-01',
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        phaseId: 'review-slug',
        name: 'Row review',
        description: 'No stored phaseId',
      },
    ]);
  });

  it('falls back to the blob phases with a null row id when there are no rows', () => {
    expect(toPhasesWithRowIds({ instance, phases: [] })).toEqual(
      blobPhases.map((phase) => ({ ...phase, id: null })),
    );
  });

  it('returns no phases when there are no rows and no blob phases', () => {
    expect(
      toPhasesWithRowIds({
        instance: { id: 'instance-2', instanceData: {} },
        phases: [],
      }),
    ).toEqual([]);
  });
});

describe('withoutRowId', () => {
  it('drops only the row id', () => {
    expect(
      withoutRowId({ id: 'row-1', phaseId: 'submission', name: 'Submission' }),
    ).toEqual({ phaseId: 'submission', name: 'Submission' });
  });
});

describe('attachPhaseRows', () => {
  it('attaches the row phases without row ids', () => {
    const result = attachPhaseRows({ instance, phases: rows });

    expect(result.phases.map(({ phaseId }) => phaseId)).toEqual([
      'submission',
      'review-slug',
    ]);
    expect(result.phases.every((phase) => !('id' in phase))).toBe(true);
    expect(result.id).toBe('instance-1');
  });

  it('attaches the blob phases without row ids when there are no rows', () => {
    expect(attachPhaseRows({ instance, phases: [] }).phases).toEqual(
      blobPhases,
    );
  });
});
