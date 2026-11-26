import { describe, expect, it } from 'vitest';

import type { SchemaMapping } from '../../../schemaMapping';
import { getDevelopPrefillSummary } from './developPrefillLog';

const sourcePhaseId = 'submission';
const developPhaseId = 'develop';

const proposalMapping: SchemaMapping = {
  from: { type: 'proposal', phaseId: sourcePhaseId },
  to: { type: 'proposal', phaseId: developPhaseId },
  fields: [
    { from: 'title', to: 'title' },
    { from: 'summary', to: 'summary' },
  ],
};

const reviewMapping: SchemaMapping = {
  from: { type: 'review', phaseId: 'any-review-phase' },
  to: { type: 'proposal', phaseId: developPhaseId },
  fields: [{ from: 'cost', to: 'budget' }],
};

describe('getDevelopPrefillSummary', () => {
  it('reports filled when every expected field has a kept value', () => {
    const summary = getDevelopPrefillSummary({
      mappings: [proposalMapping, reviewMapping],
      sourcePhaseId,
      developPhaseId,
      data: { title: 'A park', summary: 'Trees', budget: 100 },
      proposalData: {
        title: 'A park',
        budget: { amount: 100, currency: 'USD' },
      },
    });

    expect(summary).toEqual({
      outcome: 'filled',
      expectedFields: 'budget,summary,title',
      unfilledFields: '',
      rejectedFields: '',
      unmatchedMappingCount: 0,
    });
  });

  it('reports a field the sources gave no value for as unfilled', () => {
    const summary = getDevelopPrefillSummary({
      mappings: [proposalMapping],
      sourcePhaseId,
      developPhaseId,
      data: { title: 'A park' },
      proposalData: { title: 'A park' },
    });

    expect(summary).toMatchObject({
      outcome: 'partial',
      reason: 'no_value',
      unfilledFields: 'summary',
      rejectedFields: '',
    });
  });

  it('reports a system field the normalizer dropped as rejected', () => {
    const summary = getDevelopPrefillSummary({
      mappings: [proposalMapping, reviewMapping],
      sourcePhaseId,
      developPhaseId,
      data: { title: 'A park', summary: 'Trees', budget: 'not a number' },
      proposalData: { title: 'A park' },
    });

    expect(summary).toMatchObject({
      outcome: 'partial',
      reason: 'value_rejected',
      unfilledFields: '',
      rejectedFields: 'budget',
    });
  });

  it('counts a mapping that targets another phase as unmatched', () => {
    const summary = getDevelopPrefillSummary({
      mappings: [
        proposalMapping,
        { ...reviewMapping, to: { type: 'proposal', phaseId: 'results' } },
      ],
      sourcePhaseId,
      developPhaseId,
      data: { title: 'A park', summary: 'Trees' },
      proposalData: { title: 'A park' },
    });

    expect(summary).toMatchObject({
      outcome: 'partial',
      reason: 'unmatched_mapping',
      expectedFields: 'summary,title',
      unmatchedMappingCount: 1,
    });
  });

  it('counts a proposal mapping from another source phase as unmatched', () => {
    const summary = getDevelopPrefillSummary({
      mappings: [
        { ...proposalMapping, from: { type: 'proposal', phaseId: 'results' } },
        reviewMapping,
      ],
      sourcePhaseId,
      developPhaseId,
      data: { budget: 100 },
      proposalData: { budget: { amount: 100, currency: 'USD' } },
    });

    expect(summary).toMatchObject({
      outcome: 'partial',
      reason: 'unmatched_mapping',
      unfilledFields: 'summary,title',
      unmatchedMappingCount: 1,
    });
  });

  it('gives unmatched mappings priority over rejected values, and rejected values over missing ones', () => {
    const offTarget: SchemaMapping = {
      ...proposalMapping,
      to: { type: 'proposal', phaseId: 'results' },
    };
    const rejectedAndUnfilled = {
      sourcePhaseId,
      developPhaseId,
      data: { title: 'A park', budget: 'not a number' },
      proposalData: { title: 'A park' },
    };

    expect(
      getDevelopPrefillSummary({
        mappings: [proposalMapping, reviewMapping, offTarget],
        ...rejectedAndUnfilled,
      }),
    ).toMatchObject({ reason: 'unmatched_mapping' });
    expect(
      getDevelopPrefillSummary({
        mappings: [proposalMapping, reviewMapping],
        ...rejectedAndUnfilled,
      }),
    ).toMatchObject({
      reason: 'value_rejected',
      unfilledFields: 'summary',
      rejectedFields: 'budget',
    });
  });
});
