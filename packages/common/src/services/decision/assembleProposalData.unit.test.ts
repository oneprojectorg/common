import { encodeFragments } from '@op/collab';
import { createTipTapClient } from '@op/collab/testing';
import { describe, expect, it } from 'vitest';

import { assembleProposalData } from './assembleProposalData';
import { getFragmentTextFromTipTapDoc } from './getFragmentTextFromTipTapDoc';
import type { ProposalTemplateSchema } from './types';

const template: ProposalTemplateSchema = {
  type: 'object',
  properties: { budget: { type: 'object', 'x-format': 'money' } },
};

describe('assembleProposalData', () => {
  it('reads a money value that the server wrote as a fragment', async () => {
    const budget = { amount: 1250.5, currency: 'EUR' };
    const update = encodeFragments({
      copies: [],
      texts: [{ to: 'budget', text: JSON.stringify(budget) }],
    });
    if (!update) {
      throw new Error('Expected an update');
    }

    // The mock stores the update as the JSON that TipTap Cloud returns.
    const client = createTipTapClient();
    await client.createDocument('written-budget-doc', update);
    const fragments = await client.getDocumentFragments('written-budget-doc', [
      'budget',
    ]);

    expect(
      assembleProposalData(template, {
        budget: getFragmentTextFromTipTapDoc(fragments.budget),
      }),
    ).toEqual({ budget });
  });
});
