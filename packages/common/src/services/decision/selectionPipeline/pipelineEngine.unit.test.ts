import { type Proposal, ProposalStatus, Visibility } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { buildProposalRow } from '../../../../testing/helpers/proposalRows';
import { executeSelectionPipeline } from './pipelineEngine';
import type {
  ExecutionContext,
  SelectionPipeline,
  VoteAggregation,
} from './types';

describe('executeSelectionPipeline field access', () => {
  describe('blocks that evaluate per proposal read the proposal row', () => {
    it('filter reads proposalData, status and inherited properties', async () => {
      const selected = await run({
        blocks: [
          {
            id: 'filter',
            type: 'filter',
            condition: {
              and: [
                {
                  operator: 'greaterThan',
                  left: { field: 'proposalData.amount' },
                  right: { value: 15 },
                },
                {
                  operator: 'equals',
                  left: { field: 'status' },
                  right: { value: ProposalStatus.APPROVED },
                },
                {
                  operator: 'equals',
                  left: { field: 'status.length' },
                  right: { value: ProposalStatus.APPROVED.length },
                },
              ],
            },
          },
        ],
      });

      expect(selected.map((proposal) => proposal.id)).toEqual(['p2']);
    });

    it('transform reads the row and its own voteData, not the context, for every path', async () => {
      const selected = await run({
        variables: { budget: 100 },
        blocks: [
          {
            id: 'transform',
            type: 'transform',
            transformations: {
              readId: { field: 'id' },
              readTitle: { field: 'proposalData.title' },
              readMissing: { field: 'proposalData.missing' },
              readDeepMissing: { field: 'proposalData.missing.deeper' },
              readVoteData: { field: 'voteData.likesCount' },
              readVariables: { field: 'variables.budget' },
              readProposals: { field: 'proposals' },
              readProposal: { field: 'proposal' },
              readData: { field: 'data' },
              readRecord: { field: 'record' },
              readVariable: { variable: '$budget' },
            },
          },
        ],
      });

      const first = selected[0];
      if (!first) {
        throw new Error('expected a proposal');
      }
      expect(readKey(first, 'readId')).toBe('p1');
      expect(readKey(first, 'readTitle')).toBe('First');
      expect(readKey(first, 'readMissing')).toBeUndefined();
      expect(readKey(first, 'readDeepMissing')).toBeNull();
      expect(readKey(first, 'readVoteData')).toBe(7);
      expect(readKey(first, 'readVariables')).toBeNull();
      expect(readKey(first, 'readProposals')).toBeUndefined();
      expect(readKey(first, 'readProposal')).toBeUndefined();
      expect(readKey(first, 'readData')).toBeUndefined();
      expect(readKey(first, 'readRecord')).toBeUndefined();
      expect(readKey(first, 'readVariable')).toBe(100);
    });

    it('transform reads the row before its own writes', async () => {
      const selected = await run({
        blocks: [
          {
            id: 'transform',
            type: 'transform',
            transformations: {
              status: { value: 'changed' },
              oldStatus: { field: 'status' },
            },
          },
        ],
      });

      expect(
        selected.map((proposal) => readKey(proposal, 'oldStatus')),
      ).toEqual([
        ProposalStatus.APPROVED,
        ProposalStatus.APPROVED,
        ProposalStatus.DRAFT,
      ]);
    });

    it('score reads the row and its voteData in a formula', async () => {
      const selected = await run({
        blocks: [
          {
            id: 'score',
            type: 'score',
            scoreField: 'score',
            formula: {
              operator: 'add',
              operands: [
                { field: 'proposalData.amount' },
                { field: 'voteData.likesCount' },
              ],
            },
          },
        ],
      });

      expect(selected.map((proposal) => readKey(proposal, 'score'))).toEqual([
        17, 23, 35,
      ]);
    });

    it('score reads the row in criteria, including normalization', async () => {
      const selected = await run({
        blocks: [
          {
            id: 'score',
            type: 'score',
            scoreField: 'metadata.score',
            formula: [
              { field: 'proposalData.amount', weight: 1, normalize: true },
              {
                field: { field: 'proposalData.amount' },
                weight: 10,
              },
              {
                expression: {
                  operator: 'multiply',
                  operands: [{ field: 'proposalData.amount' }, { value: 2 }],
                },
                weight: 100,
              },
              { field: 'voteData.likesCount', weight: 1000, normalize: true },
            ],
          },
        ],
      });

      expect(
        selected.map((proposal) =>
          readKey(readKey(proposal, 'metadata'), 'score'),
        ),
      ).toEqual([3100, 4200.5, 6801]);
    });

    it('sort reads the row for string and expression fields', async () => {
      const selected = await run({
        blocks: [
          {
            id: 'sort',
            type: 'sort',
            sortBy: [
              { field: 'voteData.approvalRate', order: 'desc' },
              { field: 'status', order: 'asc' },
              {
                field: {
                  operator: 'multiply',
                  operands: [{ field: 'proposalData.amount' }, { value: -1 }],
                },
                order: 'asc',
              },
            ],
          },
        ],
      });

      expect(selected.map((proposal) => proposal.id)).toEqual([
        'p2',
        'p1',
        'p3',
      ]);
    });

    it('group reads the row for keys and aggregations', async () => {
      const context = makeContext();
      await executeSelectionPipeline(
        {
          version: '1.0.0',
          blocks: [
            {
              id: 'group',
              type: 'group',
              output: 'groups',
              groupBy: 'status',
              aggregations: {
                count: { operation: 'count' },
                sum: { operation: 'sum', field: 'proposalData.amount' },
                avg: { operation: 'avg', field: 'proposalData.amount' },
                min: { operation: 'min', field: 'proposalData.amount' },
                max: { operation: 'max', field: 'proposalData.amount' },
                likes: { operation: 'sum', field: 'voteData.likesCount' },
                mostLikes: { operation: 'max', field: 'voteData.likesCount' },
              },
            },
            {
              id: 'group-by-expression',
              type: 'group',
              input: 'proposals',
              output: 'groupsByExpression',
              groupBy: {
                operator: 'greaterThan',
                left: { field: 'proposalData.amount' },
                right: { value: 15 },
              },
            },
          ],
        },
        context,
      );

      expect(context.outputs.groups).toEqual([
        {
          key: ProposalStatus.APPROVED,
          proposals: [proposalOne, proposalTwo],
          aggregations: {
            count: 2,
            sum: 30,
            avg: 15,
            min: 10,
            max: 20,
            likes: 10,
            mostLikes: 7,
          },
        },
        {
          key: ProposalStatus.DRAFT,
          proposals: [proposalThree],
          aggregations: {
            count: 1,
            sum: 30,
            avg: 30,
            min: 30,
            max: 30,
            likes: 5,
            mostLikes: 5,
          },
        },
      ]);
      expect(context.outputs.groupsByExpression).toEqual([
        { key: false, proposals: [proposalOne] },
        { key: true, proposals: [proposalTwo, proposalThree] },
      ]);
    });

    it('a block after a group reads each group as its record', async () => {
      const selected = await run({
        blocks: [
          { id: 'group', type: 'group', output: 'groups', groupBy: 'status' },
          {
            id: 'filter',
            type: 'filter',
            condition: {
              operator: 'equals',
              left: { field: 'key' },
              right: { value: ProposalStatus.DRAFT },
            },
          },
        ],
      });

      expect(selected).toEqual([
        { key: ProposalStatus.DRAFT, proposals: [proposalThree] },
      ]);
    });

    it('sort and score after a group read each group as their record', async () => {
      const selected = await run({
        blocks: [
          { id: 'group', type: 'group', output: 'groups', groupBy: 'status' },
          {
            id: 'score',
            type: 'score',
            scoreField: 'size',
            formula: { field: 'proposals.length' },
          },
          {
            id: 'sort',
            type: 'sort',
            sortBy: [{ field: 'size', order: 'asc' }],
          },
        ],
      });

      expect(selected.map((group) => readKey(group, 'key'))).toEqual([
        ProposalStatus.DRAFT,
        ProposalStatus.APPROVED,
      ]);
      expect(selected.map((group) => readKey(group, 'size'))).toEqual([1, 2]);
    });
  });

  describe('blocks that evaluate once read the execution context', () => {
    it('compute reads proposals, voteData, variables and outputs', async () => {
      const context = makeContext();
      await executeSelectionPipeline(
        {
          version: '1.0.0',
          variables: { budget: 100 },
          blocks: [
            { id: 'first', type: 'limit', count: 2, output: 'firstTwo' },
            {
              id: 'compute',
              type: 'compute',
              computations: {
                proposalCount: { field: 'proposals.length' },
                firstLikes: { field: 'voteData.p1.likesCount' },
                budget: { field: 'variables.budget' },
                budgetVariable: { variable: '$budget' },
                firstTwoCount: { field: 'outputs.firstTwo.length' },
                firstTwoVariable: { variable: 'firstTwo' },
                status: { field: 'status' },
                proposalData: { field: 'proposalData.amount' },
                proposal: { field: 'proposal' },
                data: { field: 'data' },
                record: { field: 'record' },
                missing: { variable: '$missing' },
              },
            },
          ],
        },
        context,
      );

      expect(context.variables).toEqual({
        budget: 100,
        proposalCount: 2,
        firstLikes: 7,
        budgetVariable: 100,
        firstTwoCount: 2,
        firstTwoVariable: [proposalOne, proposalTwo],
        status: undefined,
        proposalData: null,
        proposal: undefined,
        data: undefined,
        record: undefined,
        missing: null,
      });
    });

    it('limit reads count and offset from the context', async () => {
      const selected = await run({
        variables: { top: 1 },
        blocks: [
          {
            id: 'limit',
            type: 'limit',
            count: { field: 'variables.top' },
            offset: { field: 'voteData.p1.voteCount' },
          },
        ],
      });

      expect(selected.map((proposal) => proposal.id)).toEqual(['p2']);
    });

    it('limit reads a missing row field as null and selects nothing', async () => {
      const selected = await run({
        blocks: [
          {
            id: 'limit',
            type: 'limit',
            count: { field: 'proposalData.amount' },
          },
        ],
      });

      expect(selected).toEqual([]);
    });

    it('branch conditions read the context and nested blocks keep each rule', async () => {
      const context = makeContext();
      const selected = await executeSelectionPipeline(
        {
          version: '1.0.0',
          blocks: [
            {
              id: 'branch',
              type: 'branch',
              branches: [
                {
                  // Reads the row path on the context, which gives null.
                  condition: {
                    operator: 'equals',
                    left: { field: 'status' },
                    right: { value: ProposalStatus.APPROVED },
                  },
                  blocks: [{ id: 'none', type: 'limit', count: 0 }],
                },
                {
                  condition: {
                    and: [
                      {
                        operator: 'equals',
                        left: { field: 'proposals.length' },
                        right: { value: 3 },
                      },
                      {
                        operator: 'equals',
                        left: { field: 'voteData.p2.voteCount' },
                        right: { value: 2 },
                      },
                    ],
                  },
                  output: 'branchOutput',
                  blocks: [
                    {
                      id: 'nested-compute',
                      type: 'compute',
                      computations: {
                        nestedCount: { field: 'proposals.length' },
                      },
                    },
                    {
                      id: 'nested-filter',
                      type: 'filter',
                      condition: {
                        operator: 'greaterThan',
                        left: { field: 'proposalData.amount' },
                        right: {
                          operator: 'multiply',
                          operands: [{ variable: 'nestedCount' }, { value: 5 }],
                        },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
        context,
      );

      expect(selected.map((proposal) => proposal.id)).toEqual(['p2', 'p3']);
      expect(context.outputs.branchOutput).toEqual([
        proposalTwo,
        proposalThree,
      ]);
    });

    it('a branch with no match runs the default branch', async () => {
      const selected = await run({
        blocks: [
          {
            id: 'branch',
            type: 'branch',
            branches: [
              {
                condition: { field: 'proposalData' },
                blocks: [{ id: 'none', type: 'limit', count: 0 }],
              },
            ],
            default: {
              blocks: [
                {
                  id: 'filter',
                  type: 'filter',
                  condition: { not: { field: 'proposals' } },
                },
              ],
            },
          },
        ],
      });

      expect(selected.map((proposal) => proposal.id)).toEqual([
        'p1',
        'p2',
        'p3',
      ]);
    });
  });
});

const proposalOne = makeProposal({
  id: 'p1',
  status: ProposalStatus.APPROVED,
  proposalData: { title: 'First', amount: 10 },
});
const proposalTwo = makeProposal({
  id: 'p2',
  status: ProposalStatus.APPROVED,
  proposalData: { title: 'Second', amount: 20 },
});
const proposalThree = makeProposal({
  id: 'p3',
  status: ProposalStatus.DRAFT,
  proposalData: { title: 'Third', amount: 30 },
});

function makeContext(): ExecutionContext {
  return {
    proposals: [proposalOne, proposalTwo, proposalThree],
    voteData: {
      p1: makeVotes({ proposalId: 'p1', likesCount: 7, voteCount: 1 }),
      p2: makeVotes({ proposalId: 'p2', likesCount: 3, voteCount: 2 }),
      p3: makeVotes({ proposalId: 'p3', likesCount: 5, voteCount: 3 }),
    },
    variables: {},
    outputs: {},
  };
}

async function run({
  blocks,
  variables,
}: {
  blocks: SelectionPipeline['blocks'];
  variables?: SelectionPipeline['variables'];
}): Promise<Proposal[]> {
  return executeSelectionPipeline(
    { version: '1.0.0', blocks, variables },
    makeContext(),
  );
}

function makeProposal({
  id,
  status,
  proposalData,
}: {
  id: string;
  status: ProposalStatus;
  proposalData: Record<string, unknown>;
}): Proposal {
  return {
    id,
    processInstanceId: 'instance',
    proposalData,
    status,
    visibility: Visibility.VISIBLE,
    submittedByProfileId: 'submitter',
    profileId: `profile-${id}`,
    lastEditedByProfileId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    moderationDetachedAt: null,
    shortCode: null,
    formSchemaId: null,
  };
}

function makeVotes({
  proposalId,
  likesCount,
  voteCount,
}: {
  proposalId: string;
  likesCount: number;
  voteCount: number;
}): VoteAggregation {
  return {
    proposalId,
    likesCount,
    followsCount: 0,
    voteCount,
    approvalCount: 0,
    rejectionCount: 0,
    abstainCount: 0,
    approvalRate: 0,
    rankCounts: {},
    votes: [],
  };
}

function readKey(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  return Reflect.get(value, key);
}

const proposal = buildProposalRow({ id: 'p1' });
const proposals = [proposal, buildProposalRow({ id: 'p2' })];
const top = (
  count: number,
  extra: Partial<{ input: string; output: string }> = {},
) => ({ id: `top-${count}`, type: 'limit' as const, count, ...extra });

describe('executeSelectionPipeline branches', () => {
  it('runs the first branch whose condition holds and stores its output', async () => {
    const outputs: Record<string, unknown> = {};
    const selected = await executeSelectionPipeline(
      {
        version: '1.0.0',
        blocks: [
          {
            id: 'route',
            type: 'branch',
            branches: [
              { condition: { value: false }, blocks: [top(2)] },
              { condition: { value: true }, blocks: [top(1)], output: 'kept' },
            ],
          },
        ],
      },
      { proposals, variables: {}, outputs },
    );

    expect(selected.map((item) => item.id)).toEqual(['p1']);
    expect(outputs.kept).toEqual(selected);
  });

  it('falls back to the default branch when no condition holds', async () => {
    const outputs: Record<string, unknown> = {};
    const selected = await executeSelectionPipeline(
      {
        version: '1.0.0',
        blocks: [
          {
            id: 'route',
            type: 'branch',
            branches: [{ condition: { value: false }, blocks: [top(2)] }],
            default: { blocks: [top(1)], output: 'fallback' },
          },
        ],
      },
      { proposals, variables: {}, outputs },
    );

    expect(selected.map((item) => item.id)).toEqual(['p1']);
    expect(outputs.fallback).toEqual(selected);
  });

  it('passes every proposal through when nothing matches and there is no default', async () => {
    const selected = await executeSelectionPipeline(
      {
        version: '1.0.0',
        blocks: [
          {
            id: 'route',
            type: 'branch',
            branches: [{ condition: { value: false }, blocks: [top(1)] }],
          },
        ],
      },
      { proposals, variables: {}, outputs: {} },
    );

    expect(selected).toHaveLength(2);
  });
});

describe('executeSelectionPipeline inputs and outputs', () => {
  it('stores each block output under its name and reads a named input', async () => {
    const outputs: Record<string, unknown> = {};

    const selected = await executeSelectionPipeline(
      {
        version: '1.0.0',
        blocks: [
          top(2, { output: 'both' }),
          top(1, { output: 'one' }),
          top(2, { input: 'both', output: 'again' }),
        ],
      },
      { proposals, variables: {}, outputs },
    );

    expect(selected).toHaveLength(2);
    expect(outputs.one).toHaveLength(1);
    expect(outputs.again).toHaveLength(2);
  });

  it('falls back to the running proposals when a named input is not a list', async () => {
    const selected = await executeSelectionPipeline(
      {
        version: '1.0.0',
        blocks: [top(1, { input: 'count' })],
      },
      { proposals, variables: {}, outputs: { count: 'x' } },
    );

    expect(selected).toHaveLength(1);
  });

  it('returns the named final output, or the running proposals when it is not a list', async () => {
    const pipeline = {
      version: '1.0.0',
      blocks: [top(2, { output: 'both' }), top(1)],
    };

    const named = await executeSelectionPipeline(
      { ...pipeline, output: 'both' },
      { proposals, variables: {}, outputs: {} },
    );
    const missing = await executeSelectionPipeline(
      { ...pipeline, output: 'nowhere' },
      { proposals, variables: {}, outputs: {} },
    );

    expect(named).toHaveLength(2);
    expect(missing).toHaveLength(1);
  });

  it('lets a computed variable replace the caller value, and a pipeline default fill a missing one', async () => {
    const three = [...proposals, buildProposalRow({ id: 'p3' })];
    const context: ExecutionContext = {
      proposals: three,
      variables: { limit: 2 },
      outputs: {},
    };

    const selected = await executeSelectionPipeline(
      {
        version: '1.0.0',
        variables: { offset: 1 },
        blocks: [
          {
            id: 'bump',
            type: 'compute',
            computations: { limit: { value: 3 } },
          },
          {
            id: 'top',
            type: 'limit',
            count: { variable: 'limit' },
            offset: { variable: 'offset' },
          },
        ],
      },
      context,
    );

    expect(selected.map((item) => item.id)).toEqual(['p2', 'p3']);
    expect(context.variables).toEqual({ limit: 3, offset: 1 });
  });

  it('wraps an unexpected failure as a pipeline error', async () => {
    await expect(
      executeSelectionPipeline(
        {
          version: '1.0.0',
          blocks: [
            {
              id: 'bad',
              type: 'filter',
              condition: { function: 'nope', arguments: [] },
            },
          ],
        },
        { proposals, variables: {}, outputs: {} },
      ),
    ).rejects.toThrow('Pipeline execution failed: Unknown function: nope');
  });
});

describe('executeSelectionPipeline variables', () => {
  it('lets the phase settings override the pipeline defaults', async () => {
    const pipeline: SelectionPipeline = {
      version: '1.0.0',
      variables: { count: 1, offset: 1 },
      blocks: [
        {
          id: 'top',
          type: 'limit',
          count: { variable: '$count' },
          offset: { variable: '$offset' },
        },
      ],
    };

    const selected = await executeSelectionPipeline(pipeline, {
      proposals,
      variables: { offset: 0 },
      outputs: {},
    });

    expect(selected.map((item) => item.id)).toEqual(['p1']);
  });
});
