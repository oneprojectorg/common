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
import {
  readCorpusForAnalysis,
  runCommonGroundPass,
  runThemesPass,
} from './runPasses';

const INSTANCE_ID = '22222222-2222-4222-8222-222222222222';
const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';

const corpusOf = (count: number, total = count, read = count) => ({
  proposals: Array.from({ length: count }, (_unused, position) => ({
    index: position + 1,
    id: `proposal-${position + 1}`,
    title: `Proposal ${position + 1}`,
    text: 'Body',
  })),
  read,
  total,
});

const themes = [
  { title: 'Street space', summary: 'Road space.', proposals: [] },
];

const habermas = { commonGround: [], outliers: [], suggestions: [] };

const readCorpus = (scope: 'phase' | 'process' = 'phase') =>
  readCorpusForAnalysis({
    processInstanceId: INSTANCE_ID,
    userId: AUTH_USER_ID,
    scope,
  });

const runThemes = () => runThemesPass({ proposals: corpusOf(4).proposals });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(collectProposalCorpus).mockResolvedValue(corpusOf(4));
  vi.mocked(analyzeThemes).mockResolvedValue(themes);
  vi.mocked(findCommonGround).mockResolvedValue(habermas);
});

describe('readCorpusForAnalysis', () => {
  it('confirms the requester exists before reading anything', async () => {
    await readCorpus();

    expect(vi.mocked(assertUserByAuthId)).toHaveBeenCalledWith(AUTH_USER_ID);
  });

  // The scope decides which proposals the run is about, so it has to survive the
  // trip from the button rather than being re-derived here.
  it('reads the scope it was asked for', async () => {
    await readCorpus('process');

    expect(vi.mocked(collectProposalCorpus)).toHaveBeenCalledWith({
      processInstanceId: INSTANCE_ID,
      userId: AUTH_USER_ID,
      scope: 'process',
    });
  });

  // The corpus travels back so the caller can hand the same list to both passes:
  // the indexes the themes pass grounds against are positions in it.
  it('returns the corpus and the scope total', async () => {
    await expect(readCorpus()).resolves.toEqual({
      ok: true,
      proposals: corpusOf(4).proposals,
      total: 4,
    });
  });

  // Reported, not thrown. An exception thrown inside an Inngest step reaches the
  // function body as a `StepError` rebuilt from name/message/stack, so the class
  // — and with it the code the app translates — would not survive.
  it('reports an under-populated corpus rather than throwing', async () => {
    vi.mocked(collectProposalCorpus).mockResolvedValue(corpusOf(1, 5));

    await expect(readCorpus()).resolves.toEqual({
      ok: false,
      code: 'not-enough-text',
      message: expect.stringContaining('had text to analyse'),
    });
  });

  // The two ways a scope comes back empty need telling apart. A read that
  // returned nothing while the count says eight is a broken read; eight read
  // with no bodies is eight empty proposals. Reporting only the survivors makes
  // the first look like the second, which sends the next person to the wrong
  // half of the code.
  it('separates a read that returned nothing from proposals with no text', async () => {
    vi.mocked(collectProposalCorpus).mockResolvedValue(corpusOf(0, 8, 0));

    const readNothing = await readCorpus('process');

    vi.mocked(collectProposalCorpus).mockResolvedValue(corpusOf(0, 8, 8));

    const readWithoutText = await readCorpus('process');

    expect(readNothing).toMatchObject({
      message: expect.stringContaining('counted 8 proposals, read 0'),
    });
    expect(readWithoutText).toMatchObject({
      message: expect.stringContaining('counted 8 proposals, read 8'),
    });
  });
});

describe('runThemesPass', () => {
  // Takes the corpus rather than reading it, so the read can sit in its own
  // Inngest step — which is what lets Inngest name the slow half.
  it('analyses the corpus it is handed, reading nothing itself', async () => {
    await expect(runThemes()).resolves.toEqual({ ok: true, themes });

    expect(vi.mocked(collectProposalCorpus)).not.toHaveBeenCalled();
    expect(vi.mocked(analyzeThemes)).toHaveBeenCalledWith(
      corpusOf(4).proposals,
    );
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
