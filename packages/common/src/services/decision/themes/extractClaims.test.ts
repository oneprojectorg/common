import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@op/logging', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const generate = vi.fn();

vi.mock('@op/ai', () => ({
  createAIAgent: vi.fn(() => ({ generate })),
  AI_PROVIDER_ID: 'op-ai',
}));

import { CommonError } from '../../../utils';
import { extractClaims } from './extractClaims';

const corpus = [
  {
    index: 1,
    id: 'proposal-a',
    title: 'Two asks',
    text: 'We want later buses on the east side. We also want a footbridge over the canal.',
  },
  {
    index: 2,
    id: 'proposal-b',
    title: 'Crossing',
    text: 'The crossing by the school feels unsafe at night.',
  },
];

const replyWith = (claims: unknown) =>
  generate.mockResolvedValue({ text: JSON.stringify({ claims }) });

beforeEach(() => {
  // Call counts are load-bearing here — the empty-corpus case asserts the model
  // was never asked — so they cannot carry over between tests.
  vi.clearAllMocks();
});

describe('extractClaims', () => {
  it('resolves each claim to the proposal it came from', async () => {
    replyWith([
      {
        proposalIndex: 1,
        claim: 'Buses on the east side should run later.',
        quote: 'We want later buses on the east side.',
      },
    ]);

    await expect(extractClaims(corpus)).resolves.toEqual([
      {
        claim: 'Buses on the east side should run later.',
        quote: 'We want later buses on the east side.',
        proposal: { id: 'proposal-a', title: 'Two asks' },
      },
    ]);
  });

  // The point of the pass. One proposal that argues two things becomes two data
  // points, which is what lets the themes pass put them in different groups.
  it('keeps several claims from one proposal as separate claims', async () => {
    replyWith([
      {
        proposalIndex: 1,
        claim: 'Buses should run later.',
        quote: 'We want later buses on the east side.',
      },
      {
        proposalIndex: 1,
        claim: 'A footbridge should be built over the canal.',
        quote: 'We also want a footbridge over the canal.',
      },
    ]);

    const claims = await extractClaims(corpus);

    expect(claims).toHaveLength(2);
    expect(claims.every(({ proposal }) => proposal.id === 'proposal-a')).toBe(
      true,
    );
  });

  // A claim is a claim about one proposal. With no proposal there is nothing
  // left for it to be about — the same reading that drops an outlier naming a
  // proposal the corpus does not hold.
  it('drops a claim attributed to a proposal the corpus does not hold', async () => {
    replyWith([{ proposalIndex: 99, claim: 'Invented.', quote: 'Invented.' }]);

    await expect(extractClaims(corpus)).resolves.toEqual([]);
  });

  // The quote is the only part of a claim a facilitator can check without
  // re-reading the proposal, which is exactly why it is not taken on trust.
  it('empties a quote that is not in the proposal it is attributed to', async () => {
    replyWith([
      {
        proposalIndex: 2,
        claim: 'Someone was hurt at the crossing.',
        quote: 'A child was hit by a car at the crossing.',
      },
    ]);

    const [claim] = await extractClaims(corpus);

    // Kept, because the model did read the proposal and the claim may still be
    // worth showing — but shown without evidence, which is what it has.
    expect(claim?.claim).toBe('Someone was hurt at the crossing.');
    expect(claim?.quote).toBe('');
  });

  // A quote attributed to the wrong proposal is as fabricated as an invented
  // one: the words exist in the corpus, but not where the claim says they do.
  it('empties a quote that belongs to a different proposal', async () => {
    replyWith([
      {
        proposalIndex: 2,
        claim: 'Buses should run later.',
        quote: 'We want later buses on the east side.',
      },
    ]);

    const [claim] = await extractClaims(corpus);

    expect(claim?.quote).toBe('');
  });

  // A model asked to copy will re-wrap lines and change case. That is tidying,
  // not fabrication, and rejecting it would throw away sound evidence.
  it('accepts a quote that differs only in case and whitespace', async () => {
    replyWith([
      {
        proposalIndex: 2,
        claim: 'The crossing feels unsafe after dark.',
        quote: 'the crossing by the school\n  feels unsafe at night.',
      },
    ]);

    const [claim] = await extractClaims(corpus);

    expect(claim?.quote).toBe(
      'the crossing by the school\n  feels unsafe at night.',
    );
  });

  // Punctuation is not tidying. "we should fund it" and "we should fund it?"
  // are different claims about what a proposal said.
  it('rejects a quote that differs in punctuation', async () => {
    replyWith([
      {
        proposalIndex: 2,
        claim: 'The crossing is unsafe.',
        quote: 'The crossing by the school feels unsafe at night!',
      },
    ]);

    const [claim] = await extractClaims(corpus);

    expect(claim?.quote).toBe('');
  });

  it('refuses an empty corpus without asking the model', async () => {
    await expect(extractClaims([])).rejects.toMatchObject({
      code: 'not-enough-text',
    });

    expect(generate).not.toHaveBeenCalled();
  });

  it('fails when the reply is not usable JSON', async () => {
    generate.mockResolvedValue({ text: 'I would rather not.' });

    await expect(extractClaims(corpus)).rejects.toBeInstanceOf(CommonError);
  });

  it('sends the fenced corpus as the prompt', async () => {
    replyWith([]);

    await extractClaims(corpus);

    expect(generate.mock.calls[0]?.[0]).toContain('<proposal index="1">');
  });
});
