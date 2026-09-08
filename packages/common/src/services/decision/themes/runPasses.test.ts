import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@op/logging', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Boundary mocks. What these tests are about is how a pass *reports* what
// happened, so the corpus read and the two model passes are driven directly.
vi.mock('../../assert', () => ({ assertUserByAuthId: vi.fn() }));
vi.mock('./collectProposalCorpus', () => ({ collectProposalCorpus: vi.fn() }));
vi.mock('./analyzeThemes', () => ({ analyzeThemes: vi.fn() }));
vi.mock('./findCommonGround', () => ({ findCommonGround: vi.fn() }));

import { assertUserByAuthId } from '../../assert';
import { ThemeAnalysisFailure } from './ThemeAnalysisFailure';
import { analyzeThemes } from './analyzeThemes';
import { collectProposalCorpus } from './collectProposalCorpus';
import { findCommonGround } from './findCommonGround';
import { runCommonGroundPass, runThemesPass } from './runPasses';

const INSTANCE_ID = '22222222-2222-4222-8222-222222222222';
const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';

const corpusOf = (count: number, total = count) => ({
  proposals: Array.from({ length: count }, (_unused, position) => ({
    index: position + 1,
    id: `proposal-${position + 1}`,
    title: `Proposal ${position + 1}`,
    text: 'Body',
  })),
  total,
});

const themes = [
  { title: 'Street space', summary: 'Road space.', proposals: [] },
];

const habermas = { commonGround: [], outliers: [], suggestions: [] };

const runThemes = (scope: 'phase' | 'process' = 'phase') =>
  runThemesPass({
    processInstanceId: INSTANCE_ID,
    userId: AUTH_USER_ID,
    scope,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(collectProposalCorpus).mockResolvedValue(corpusOf(4));
  vi.mocked(analyzeThemes).mockResolvedValue(themes);
  vi.mocked(findCommonGround).mockResolvedValue(habermas);
});

describe('runThemesPass', () => {
  it('confirms the requester exists before reading anything', async () => {
    await runThemes();

    expect(vi.mocked(assertUserByAuthId)).toHaveBeenCalledWith(AUTH_USER_ID);
  });

  // The scope decides which proposals the run is about, so it has to survive the
  // trip from the button rather than being re-derived here.
  it('reads the scope it was asked for', async () => {
    await runThemes('process');

    expect(vi.mocked(collectProposalCorpus)).toHaveBeenCalledWith({
      processInstanceId: INSTANCE_ID,
      userId: AUTH_USER_ID,
      scope: 'process',
    });
  });

  // The corpus travels back because the second pass must read the same one: the
  // indexes the themes pass grounded against are positions in this list.
  it('returns the corpus alongside the themes', async () => {
    const result = await runThemes();

    expect(result).toEqual({
      ok: true,
      themes,
      proposals: corpusOf(4).proposals,
      total: 4,
    });
  });

  // Reported, not thrown. An exception thrown inside an Inngest step reaches the
  // function body as a `StepError` rebuilt from name/message/stack, so the class
  // — and with it the code the app translates — would not survive. Returning is
  // also what stops the retry: an empty corpus is just as empty second time, and
  // re-running costs another corpus read.
  it('reports an under-populated corpus rather than throwing', async () => {
    vi.mocked(collectProposalCorpus).mockResolvedValue(corpusOf(1, 5));

    await expect(runThemes()).resolves.toEqual({
      ok: false,
      code: 'not-enough-text',
      message: expect.stringContaining('1 of'),
    });
  });

  it('does not call the model when the corpus is too small', async () => {
    vi.mocked(collectProposalCorpus).mockResolvedValue(corpusOf(1, 5));

    await runThemes();

    expect(vi.mocked(analyzeThemes)).not.toHaveBeenCalled();
  });

  it('reports an unusable model reply with its code', async () => {
    vi.mocked(analyzeThemes).mockRejectedValue(
      new ThemeAnalysisFailure(
        'analysis-unusable',
        'The proposal-themes pass did not return usable JSON.',
      ),
    );

    await expect(runThemes()).resolves.toEqual({
      ok: false,
      code: 'analysis-unusable',
      message: 'The proposal-themes pass did not return usable JSON.',
    });
  });

  // Narrow on purpose: a database or network fault is not something this can
  // describe, and swallowing it would report a wrong reason and skip the retry
  // that might actually fix it.
  it('re-throws a fault it cannot classify', async () => {
    vi.mocked(analyzeThemes).mockRejectedValue(new Error('connection reset'));

    await expect(runThemes()).rejects.toThrow('connection reset');
  });
});

describe('runCommonGroundPass', () => {
  const run = () =>
    runCommonGroundPass({ themes, proposals: corpusOf(4).proposals });

  it('returns the analysis it produced', async () => {
    await expect(run()).resolves.toEqual({ ok: true, analysis: habermas });
  });

  it('reports an unusable model reply with its code', async () => {
    vi.mocked(findCommonGround).mockRejectedValue(
      new ThemeAnalysisFailure('analysis-unusable', 'Malformed reply.'),
    );

    await expect(run()).resolves.toEqual({
      ok: false,
      code: 'analysis-unusable',
      message: 'Malformed reply.',
    });
  });

  it('re-throws a fault it cannot classify', async () => {
    vi.mocked(findCommonGround).mockRejectedValue(new Error('socket hang up'));

    await expect(run()).rejects.toThrow('socket hang up');
  });
});
