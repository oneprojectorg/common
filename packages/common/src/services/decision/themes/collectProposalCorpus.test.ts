import { beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mock: the corpus read is shaping over `listProposals`. We drive what
// that returns and assert what reaches the model.
vi.mock('../listProposals', () => ({
  listProposals: vi.fn(),
}));

vi.mock('../listAllProposals', () => ({
  listAllProposals: vi.fn(),
}));

import { listAllProposals } from '../listAllProposals';
import { listProposals } from '../listProposals';
import { collectProposalCorpus } from './collectProposalCorpus';
import {
  THEME_ANALYSIS_MAX_PROPOSALS,
  THEME_ANALYSIS_PROPOSAL_CHARS,
} from './constants';

const INSTANCE_ID = '22222222-2222-4222-8222-222222222222';
const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';

const proposalRow = ({
  id,
  title,
  previewText,
}: {
  id: string;
  title?: string;
  previewText?: string;
}) => ({ id, proposalData: { title }, previewText });

const answerWith = ({
  proposals,
  total,
}: {
  proposals: ReturnType<typeof proposalRow>[];
  total?: number;
}) => {
  vi.mocked(listProposals).mockResolvedValue({
    proposals,
    total: total ?? proposals.length,
  } as never);
};

const collect = (scope: 'phase' | 'process' = 'phase') =>
  collectProposalCorpus({
    processInstanceId: INSTANCE_ID,
    userId: AUTH_USER_ID,
    scope,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listAllProposals).mockResolvedValue({
    items: [],
    total: 0,
  } as never);
});

describe('collectProposalCorpus', () => {
  // The filters this read omits are what an analysis covers. A narrowing that
  // arrives by way of a spread is a key nobody writes a test for, so the input
  // is asserted whole rather than by naming what should be absent.
  it('reads the phase whole, at the ceiling, with no filters', async () => {
    answerWith({ proposals: [] });

    await collect();

    expect(vi.mocked(listProposals).mock.calls[0]?.[0]).toEqual({
      input: {
        processInstanceId: INSTANCE_ID,
        limit: THEME_ANALYSIS_MAX_PROPOSALS,
        skipAccessCheck: true,
      },
      user: { id: AUTH_USER_ID },
    });
  });

  // The two surfaces show different sets: the proposals list shows the current
  // phase, results shows everything the instance has held. Reading the wrong one
  // would report a synthesis of proposals the reader is not looking at.
  it('reads every proposal the instance holds when the scope is the process', async () => {
    vi.mocked(listAllProposals).mockResolvedValue({
      items: [
        {
          id: 'a',
          proposalData: { title: 'Dropped in an earlier phase' },
          previewText: 'Body',
        },
      ],
      total: 40,
    } as never);

    const { proposals, total } = await collect('process');

    expect(vi.mocked(listProposals)).not.toHaveBeenCalled();
    expect(vi.mocked(listAllProposals).mock.calls[0]?.[0]).toEqual({
      input: {
        processInstanceId: INSTANCE_ID,
        limit: THEME_ANALYSIS_MAX_PROPOSALS,
      },
      user: { id: AUTH_USER_ID },
    });
    expect({ analyzed: proposals.length, total }).toEqual({
      analyzed: 1,
      total: 40,
    });
  });

  it('numbers the corpus from one, in the order it was read', async () => {
    answerWith({
      proposals: [
        proposalRow({ id: 'a', title: 'Bike lanes', previewText: 'One' }),
        proposalRow({ id: 'b', title: 'Bus lanes', previewText: 'Two' }),
      ],
    });

    const { proposals } = await collect();

    expect(proposals).toEqual([
      { index: 1, id: 'a', title: 'Bike lanes', text: 'One' },
      { index: 2, id: 'b', title: 'Bus lanes', text: 'Two' },
    ]);
  });

  // A title alone gives the model nothing to find a theme in, and it would still
  // occupy a slot under the ceiling.
  it('drops proposals with no body text and closes the gap in the numbering', async () => {
    answerWith({
      proposals: [
        proposalRow({ id: 'a', title: 'Kept', previewText: 'Real text' }),
        proposalRow({ id: 'b', title: 'Empty', previewText: '   ' }),
        proposalRow({ id: 'c', title: 'Missing' }),
        proposalRow({ id: 'd', title: 'Also kept', previewText: 'More text' }),
      ],
    });

    const { proposals, read } = await collect();

    expect(proposals.map(({ index, id }) => [index, id])).toEqual([
      [1, 'a'],
      [2, 'd'],
    ]);
    // Counted before the drop, so an empty corpus can be attributed. Four rows
    // read and two analysed is two empty proposals; zero read is a reader that
    // returned nothing, which is a different bug in a different query.
    expect(read).toBe(4);
  });

  // Empty rather than a placeholder: the title is stored on the record and
  // rendered to a facilitator in their own locale, so the stand-in belongs at
  // the point of display. The prompt gets its own from `renderCorpusForPrompt`.
  it('leaves an untitled proposal untitled rather than baking in English', async () => {
    answerWith({
      proposals: [proposalRow({ id: 'a', previewText: 'Body' })],
    });

    const { proposals } = await collect();

    expect(proposals[0]?.title).toBe('');
  });

  it('trims each proposal to the per-proposal budget', async () => {
    answerWith({
      proposals: [
        proposalRow({
          id: 'a',
          title: 'Long',
          previewText: 'x'.repeat(THEME_ANALYSIS_PROPOSAL_CHARS + 500),
        }),
      ],
    });

    const { proposals } = await collect();

    expect(proposals[0]?.text).toHaveLength(THEME_ANALYSIS_PROPOSAL_CHARS);
  });

  // The ceiling is what makes an analysis potentially partial, so the count the
  // caller reports alongside it has to be the phase's, not the corpus's.
  it('reports the phase total, not how many were taken', async () => {
    answerWith({
      proposals: [proposalRow({ id: 'a', title: 'One', previewText: 'Body' })],
      total: 400,
    });

    const { proposals, total } = await collect();

    expect({ analyzed: proposals.length, total }).toEqual({
      analyzed: 1,
      total: 400,
    });
  });
});
