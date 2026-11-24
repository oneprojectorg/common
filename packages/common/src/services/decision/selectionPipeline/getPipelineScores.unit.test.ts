import { describe, expect, it } from 'vitest';

import { buildProposalRow } from '../../../../testing/helpers/proposalRows';
import { setValueByPath } from './expressionEvaluator';
import { getPipelineScores } from './getPipelineScores';

describe('getPipelineScores', () => {
  it('returns a copy of the metadata a block wrote', () => {
    const proposal = buildProposalRow({ id: 'p' });
    setValueByPath(proposal, 'metadata.rankPoints', 7);

    const scores = getPipelineScores(proposal);

    expect(scores).toEqual({ rankPoints: 7 });
    scores.rankPoints = 0;
    expect(getPipelineScores(proposal)).toEqual({ rankPoints: 7 });
  });

  it('returns nothing for a row no block wrote on', () => {
    expect(getPipelineScores(buildProposalRow({ id: 'p' }))).toEqual({});
  });

  it.each([null, [1], 'text'])(
    'returns nothing when metadata is %j rather than an object',
    (metadata) => {
      const proposal = buildProposalRow({ id: 'p' });
      setValueByPath(proposal, 'metadata', metadata);

      expect(getPipelineScores(proposal)).toEqual({});
    },
  );
});
