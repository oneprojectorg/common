import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { themeAnalysisRecordSchema } from './themeAnalysis';

/**
 * The fields the workflow holds for the whole run and merges into every write.
 *
 * Mirrors `AnalysisIdentity` in `analyzeProposalThemes`. The workflow writes
 * whole records rather than patches, so identity plus one write's fields has to
 * be a complete record — and a record that is not is unreadable, because
 * `getThemeAnalysisStatus` parses what it reads and reports a parse failure as
 * `not_found`.
 */
const identity = {
  analysisId: '4f2a3d92-129d-4260-8ff7-90fc020aa245',
  processInstanceId: '7366db3b-45bc-4ee1-b8ff-ed36429e46b6',
  userId: 'a8e6e9f0-75dc-4cfb-9b58-55242c9573a0',
  createdAt: '2026-09-08T19:54:31.549Z',
  scope: 'process',
};

const issuesOf = (record: unknown) => {
  const parsed = themeAnalysisRecordSchema.safeParse(record);

  return parsed.success
    ? []
    : parsed.error.issues.map((issue) => issue.path.join('.'));
};

describe('the records the workflow writes', () => {
  // The regression this file exists for. `createdAt` is required, and the two
  // terminal writes did not carry it: the seed had one, the `processing` write
  // passed one by hand, and `completed` and `failed` had none. Both wrote a
  // record that failed this schema on the way back out, so a finished analysis
  // read to the client as an analysis that never existed — and the client sat on
  // "Preparing..." for a run whose result was in the cache the whole time.
  it.each([
    [
      'completed',
      {
        status: 'completed',
        result: {
          themes: [],
          commonGround: [],
          outliers: [],
          suggestions: [],
        },
        analyzedCount: 8,
        total: 8,
        completedAt: '2026-09-08T19:55:02.000Z',
      },
    ],
    [
      'failed',
      {
        status: 'failed',
        errorCode: 'analysis-unusable',
        errorMessage: 'The proposal-themes pass did not answer.',
        completedAt: '2026-09-08T19:55:02.000Z',
      },
    ],
    ['processing', { status: 'processing' }],
  ])('a %s write is a readable record', (_name, fields) => {
    expect(issuesOf({ ...identity, ...fields })).toEqual([]);
  });

  // The seed is the one record the request writes rather than the workflow, and
  // it carries no scope — that lives in the key. It still has to parse.
  it('the seed the request writes is a readable record', () => {
    const { scope: _scope, ...seed } = identity;

    expect(issuesOf({ ...seed, status: 'pending' })).toEqual([]);
  });

  // Guards the guard: if `createdAt` ever becomes optional, the tests above stop
  // testing anything and the workflow's type-level check loses its meaning.
  it('still requires the field whose absence caused that', () => {
    const { createdAt: _createdAt, ...withoutCreatedAt } = identity;

    expect(issuesOf({ ...withoutCreatedAt, status: 'processing' })).toEqual([
      'createdAt',
    ]);
  });
});
