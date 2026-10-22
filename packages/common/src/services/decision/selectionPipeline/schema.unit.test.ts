import { describe, expect, it } from 'vitest';

import * as pipelineFixtures from '../../../../testing/helpers/pipelineSchemas';
import { decisionTemplates } from '../schemas/definitions';
import { selectionPipelineSchema } from './schema';

const knownPipelines = [
  ...Object.values(decisionTemplates),
  ...Object.values(pipelineFixtures),
].flatMap((template) =>
  template.phases.flatMap((phase) =>
    'selectionPipeline' in phase && phase.selectionPipeline
      ? [[`${template.id}/${phase.id}`, phase.selectionPipeline] as const]
      : [],
  ),
);

describe('selectionPipelineSchema', () => {
  it('has pipelines to check', () => {
    expect(knownPipelines.length).toBeGreaterThan(0);
  });

  it.each(knownPipelines)(
    'accepts the %s pipeline unchanged',
    (_, pipeline) => {
      expect(selectionPipelineSchema.parse(pipeline)).toEqual(pipeline);
    },
  );

  it('keeps block fields beyond the shared ones', () => {
    const pipeline = {
      version: '1.0.0',
      blocks: [
        {
          id: 'route',
          type: 'branch',
          branches: [
            {
              condition: {
                and: [
                  {
                    operator: 'greaterThan',
                    left: { field: 'voteData.voteCount' },
                    right: { variable: 'threshold' },
                  },
                  { not: { value: false } },
                ],
              },
              blocks: [
                {
                  id: 'keep',
                  type: 'filter',
                  condition: {
                    function: 'coalesce',
                    arguments: [
                      { field: 'voteData.approvalRate' },
                      { value: 0 },
                    ],
                  },
                },
              ],
            },
          ],
          default: { blocks: [{ id: 'cut', type: 'limit', count: 3 }] },
        },
        {
          id: 'rank',
          type: 'score',
          scoreField: 'metadata.score',
          formula: [
            { field: 'voteData.likesCount', weight: 2, normalize: true },
          ],
        },
      ],
      variables: { threshold: 5 },
    };

    expect(selectionPipelineSchema.parse(pipeline)).toEqual(pipeline);
  });

  it('rejects a block type no executor handles', () => {
    expect(
      selectionPipelineSchema.safeParse({
        version: '1.0.0',
        blocks: [{ id: 'top', type: 'limt', count: 3 }],
      }).success,
    ).toBe(false);
  });

  it('rejects a block missing its own required field', () => {
    expect(
      selectionPipelineSchema.safeParse({
        version: '1.0.0',
        blocks: [{ id: 'keep', type: 'filter' }],
      }).success,
    ).toBe(false);
  });

  it('rejects an unknown key rather than dropping it', () => {
    expect(
      selectionPipelineSchema.safeParse({
        version: '1.0.0',
        blocks: [{ id: 'top', type: 'limit', count: 3, cap: 10 }],
      }).success,
    ).toBe(false);
  });

  it.each([
    ['an empty logical expression', {}],
    ['a literal without a value', { value: undefined }],
    [
      'an unknown comparison operator',
      {
        operator: 'roughlyEquals',
        left: { field: 'a' },
        right: { value: 1 },
      },
    ],
    ['two expression kinds at once', { field: 'a', variable: 'b' }],
  ])('rejects %s', (_, condition) => {
    expect(
      selectionPipelineSchema.safeParse({
        version: '1.0.0',
        blocks: [{ id: 'keep', type: 'filter', condition }],
      }).success,
    ).toBe(false);
  });
});
