import { getTipTapClient } from '@op/collab';

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
  title?: string,
): Promise<void> {
  const parsed = parseProposalData(proposalData);
  const storedProposalData =
    proposalData && typeof proposalData === 'object'
      ? (proposalData as Record<string, unknown>)
      : {};
  const shouldInjectTitle =
    storedProposalData.title === undefined && title !== undefined;

  if (parsed.collaborationDocId) {
    const client = getTipTapClient();

    const fragmentNames = getProposalFragmentNames(proposalTemplate);
    const fragmentTexts = await client.getDocumentFragments(
      parsed.collaborationDocId,
      fragmentNames,
      { format: 'text' },
    );
    const validationData = {
      ...assembleProposalData(proposalTemplate, fragmentTexts),
      ...(storedProposalData.category !== undefined
        ? {
            category:
              parsed.category.length > 0
                ? parsed.category
                : storedProposalData.category,
          }
        : {}),
      ...(storedProposalData.budget !== undefined
        ? { budget: parsed.budget }
        : {}),
      ...(shouldInjectTitle ? { title } : {}),
    };

    schemaValidator.assertProposalData(proposalTemplate, validationData);
  } else {
    schemaValidator.assertProposalData(proposalTemplate, {
      ...storedProposalData,
      ...(shouldInjectTitle ? { title } : {}),
    });
  }
}
