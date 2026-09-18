import type { Proposal, XFormatPropertySchema } from '@op/common/client';
import { describe, expect, it } from 'vitest';

import { buildUpdateProposalPayload } from './buildUpdateProposalPayload';

const proposal: Pick<Proposal, 'id' | 'proposalData'> = {
  id: 'proposal-1',
  proposalData: {
    category: [],
    budget: null,
    location: null,
    attachmentIds: [],
  },
};

const schemaWithOptions: XFormatPropertySchema = {
  type: 'string',
  oneOf: [{ const: 'parks', title: 'Parks' }],
};

describe('buildUpdateProposalPayload', () => {
  it('carries the draft title, category and budget into the payload', () => {
    const payload = buildUpdateProposalPayload({
      proposal,
      currentDraft: { title: 'A title', category: ['parks'], budget: null },
      collaborationDocId: 'doc-1',
      categorySchema: schemaWithOptions,
      isDraft: true,
    });

    expect(payload).toEqual({
      proposalId: 'proposal-1',
      data: {
        title: 'A title',
        proposalData: expect.objectContaining({
          collaborationDocId: 'doc-1',
          category: ['parks'],
          budget: undefined,
        }),
      },
    });
  });

  it('omits checkpointVersion for a draft submit', () => {
    const payload = buildUpdateProposalPayload({
      proposal,
      currentDraft: { title: 'A title', category: [], budget: null },
      collaborationDocId: 'doc-1',
      categorySchema: undefined,
      isDraft: true,
    });

    expect(payload.data).not.toHaveProperty('checkpointVersion');
  });

  it('adds an update checkpoint for a non-draft edit', () => {
    const payload = buildUpdateProposalPayload({
      proposal,
      currentDraft: { title: 'A title', category: [], budget: null },
      collaborationDocId: 'doc-1',
      categorySchema: undefined,
      isDraft: false,
    });

    expect(payload.data).toMatchObject({
      checkpointVersion: { type: 'update' },
    });
  });
});
