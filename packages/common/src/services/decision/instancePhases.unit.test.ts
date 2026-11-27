import { describe, expect, it, vi } from 'vitest';

import type { ProcessPhaseWithProfile } from './phaseHelpers';

vi.mock('@op/db/client', () => ({
  db: {},
  asc: () => undefined,
  eq: () => undefined,
  inArray: () => undefined,
}));

const { attachPhaseRows, toPhases } = await import('./instancePhases');

const blobPhases = [
  { phaseId: 'submission', name: 'Blob submission', startDate: '2026-01-01' },
  { phaseId: 'voting', name: 'Blob voting' },
];

const instance = {
  id: 'instance-1',
  instanceData: { phases: blobPhases },
};

const storedPhases: ProcessPhaseWithProfile[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    profileId: 'profile-1',
    sortOrder: 0,
    data: { phaseId: 'submission', startDate: '2026-02-01' },
    name: 'Stored submission',
    slug: 'submission-slug',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    profileId: 'profile-2',
    sortOrder: 1,
    data: { description: 'No stored phaseId' },
    name: 'Stored review',
    slug: 'review-slug',
  },
];

describe('toPhases', () => {
  it('builds each phase from its stored phase and keeps its id and slug, in order', () => {
    expect(toPhases({ instance, storedPhases })).toEqual([
      {
        id: '00000000-0000-4000-8000-000000000001',
        slug: 'submission-slug',
        phaseId: 'submission',
        name: 'Stored submission',
        startDate: '2026-02-01',
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        slug: 'review-slug',
        phaseId: 'review-slug',
        name: 'Stored review',
        description: 'No stored phaseId',
      },
    ]);
  });

  it('falls back to the blob phases with a null id and slug when there are no stored phases', () => {
    expect(toPhases({ instance, storedPhases: [] })).toEqual(
      blobPhases.map((phase) => ({ ...phase, id: null, slug: null })),
    );
  });

  it('returns no phases when there are no stored or blob phases', () => {
    expect(
      toPhases({
        instance: { id: 'instance-2', instanceData: {} },
        storedPhases: [],
      }),
    ).toEqual([]);
  });
});

describe('attachPhaseRows', () => {
  it('attaches the stored phases without ids', () => {
    const result = attachPhaseRows({ instance, storedPhases });

    expect(result.phases).toEqual([
      {
        phaseId: 'submission',
        name: 'Stored submission',
        startDate: '2026-02-01',
      },
      {
        phaseId: 'review-slug',
        name: 'Stored review',
        description: 'No stored phaseId',
      },
    ]);
    expect(result.id).toBe('instance-1');
  });

  it('attaches the blob phases without ids when there are no stored phases', () => {
    expect(attachPhaseRows({ instance, storedPhases: [] }).phases).toEqual(
      blobPhases,
    );
  });
});
