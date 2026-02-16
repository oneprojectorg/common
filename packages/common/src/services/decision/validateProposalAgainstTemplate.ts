import { createTipTapClient } from '@op/collab';

import { CommonError } from '../../utils';
import { assembleProposalData } from './assembleProposalData';
import { getProposalFragmentNames } from './getProposalFragmentNames';
import { parseProposalData } from './proposalDataSchema';
import { schemaValidator } from './schemaValidator';
import type { ProposalTemplateSchema } from './types';

/**
 * Validates proposal data against a proposal template schema.
 *
 * For proposals with a TipTap collaboration document, fetches the latest
 * field values from the Yjs doc and assembles them before validation.
 * For legacy proposals without a collab doc, validates the raw proposalData directly.
 *
 * @throws {ValidationError} when the proposal data does not satisfy the template schema
 * @throws {CommonError} when TipTap credentials are missing for a collab-doc proposal
 */
export async function validateProposalAgainstTemplate(
  proposalTemplate: ProposalTemplateSchema,
  proposalData: unknown,
): Promise<void> {
  const parsed = parseProposalData(proposalData);

  if (parsed.collaborationDocId) {
    const appId = process.env.NEXT_PUBLIC_TIPTAP_APP_ID;
    const secret = process.env.TIPTAP_SECRET;

    if (!appId || !secret) {
      throw new CommonError(
        'TipTap credentials not configured, cannot validate proposal',
      );
    }

    const client = createTipTapClient({ appId, secret });
    const fragmentNames = getProposalFragmentNames(proposalTemplate);
    const fragmentTexts = await client.getDocumentFragments(
      parsed.collaborationDocId,
      fragmentNames,
      'text',
    );
    const validationData = assembleProposalData(
      proposalTemplate,
      fragmentTexts,
    );

    schemaValidator.validateProposalData(proposalTemplate, validationData);
  } else {
    schemaValidator.validateProposalData(proposalTemplate, proposalData);
  }
}
