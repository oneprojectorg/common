import { describe, expect, it } from 'vitest';

import { buildProposalRow } from '../../../../testing/helpers/proposalRows';
import { setValueByPath } from './expressionEvaluator';
import { getPipelineMetadata } from './getPipelineMetadata';

describe('getPipelineMetadata', () => {
  it('returns a copy of the metadata a block wrote', () => {
    const proposal = buildProposalRow({ id: 'p' });
    setValueByPath(proposal, 'metadata.rankPoints', 7);

    const metadata = getPipelineMetadata(proposal);

    expect(metadata).toEqual({ rankPoints: 7 });
    metadata.rankPoints = 0;
    expect(getPipelineMetadata(proposal)).toEqual({ rankPoints: 7 });
  });

  it('returns nothing for a row no block wrote on', () => {
    expect(getPipelineMetadata(buildProposalRow({ id: 'p' }))).toEqual({});
  });

  it.each([null, [1], 'text'])(
    'returns nothing when metadata is %j rather than an object',
    (metadata) => {
      const proposal = buildProposalRow({ id: 'p' });
      setValueByPath(proposal, 'metadata', metadata);

      expect(getPipelineMetadata(proposal)).toEqual({});
    },
  );
});
