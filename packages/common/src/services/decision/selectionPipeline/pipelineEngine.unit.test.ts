import { describe, expect, it } from 'vitest';

import { buildProposalRow } from '../../../../testing/helpers/proposalRows';
import { executeSelectionPipeline } from './pipelineEngine';
import type { ExecutionContext } from './types';

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

describe('executeSelectionPipeline skipped proposals', () => {
  it('collects what a budget block skipped onto the context', async () => {
    const context: ExecutionContext = {
      proposals: [
        buildProposalRow({ id: 'big' }),
        buildProposalRow({ id: 'small' }),
      ],
      proposalCosts: new Map([
        ['big', 5],
        ['small', 1],
      ]),
      variables: {},
      outputs: {},
    };

    const selected = await executeSelectionPipeline(
      {
        version: '1.0.0',
        blocks: [{ id: 'fit', type: 'budget', budget: 2 }],
      },
      context,
    );

    expect(selected.map((proposal) => proposal.id)).toEqual(['small']);
    expect(context.skipped?.map((proposal) => proposal.id)).toEqual(['big']);
  });

  it('keeps what every budget block skipped, including one inside a branch', async () => {
    const context: ExecutionContext = {
      proposals: [
        buildProposalRow({ id: 'huge' }),
        buildProposalRow({ id: 'big' }),
        buildProposalRow({ id: 'small' }),
      ],
      proposalCosts: new Map([
        ['huge', 9],
        ['big', 5],
        ['small', 1],
      ]),
      variables: {},
      outputs: {},
    };

    const selected = await executeSelectionPipeline(
      {
        version: '1.0.0',
        blocks: [
          { id: 'cap', type: 'budget', budget: 6 },
          {
            id: 'route',
            type: 'branch',
            branches: [
              {
                condition: { value: true },
                blocks: [{ id: 'fit', type: 'budget', budget: 2 }],
              },
            ],
          },
        ],
      },
      context,
    );

    expect(selected.map((proposal) => proposal.id)).toEqual(['small']);
    expect(context.skipped?.map((proposal) => proposal.id)).toEqual([
      'huge',
      'big',
    ]);
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
