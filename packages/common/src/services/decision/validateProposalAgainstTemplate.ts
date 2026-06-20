import { getTipTapClient } from '@op/collab';

import { assembleProposalData } from './assembleProposalData';
import { fillCategoryFromBoundary } from './boundaryCategory';
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
 * Returns the assembled validation data for collab-doc proposals (the
 * authoritative fragment values at validation time), or `null` for legacy
 * proposals validated from stored proposalData.
 *
 * @throws {ValidationError} when the proposal data does not satisfy the template schema
 * @throws {CommonError} when TipTap credentials are missing for a collab-doc proposal
 */
export async function validateProposalAgainstTemplate(
  proposalTemplate: ProposalTemplateSchema,
  proposalData: unknown,
  title?: string,
): Promise<Record<string, unknown> | null> {
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
        ? { category: storedProposalData.category }
        : {}),
      ...(storedProposalData.budget !== undefined
        ? { budget: parsed.budget }
        : {}),
      ...(shouldInjectTitle ? { title } : {}),
    };

    // Auto-fill the council-district category from the location's boundary
    // before validating — the server-side replacement for the former
    // client-side auto-select. From here on the district is a normal category.
    const finalData = await fillCategoryFromBoundary(
      proposalTemplate,
      validationData,
    );

    schemaValidator.assertProposalData(proposalTemplate, finalData);
    return finalData;
  }

  schemaValidator.assertProposalData(proposalTemplate, {
    ...storedProposalData,
    ...(shouldInjectTitle ? { title } : {}),
  });
  return null;
}
