import { createTipTapClient } from '@op/collab';

import { CommonError } from '../../utils';
import { assembleProposalData } from './assembleProposalData';
import { getProposalFragmentNames } from './getProposalFragmentNames';
import {
  SYSTEM_FIELD_KEYS,
} from './getProposalTemplateFieldOrder';
import {
  extractBudgetValue,
  normalizeBudget,
  parseProposalData,
} from './proposalDataSchema';
import { schemaValidator } from './schemaValidator';
import type { ProposalTemplateSchema } from './types';

/**
 * Validates proposal data against a proposal template schema.
 *
 * For proposals with a TipTap collaboration document, fetches the latest
 * field values from the Yjs doc and assembles them before validation.
 * System fields (title, budget, category) are read from proposalData
 * directly since they are not stored as TipTap fragments.
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

    // System fields (title, budget, category) are stored in proposalData,
    // not as TipTap fragments, so merge them into the validation data.
    // Use the parsed data so values are normalized (e.g. budget).
    for (const key of SYSTEM_FIELD_KEYS) {
      if (parsed[key] !== undefined && validationData[key] === undefined) {
        if (key === 'budget' && parsed.budget) {
          const schema = proposalTemplate.properties?.[key];
          validationData[key] =
            schema?.type === 'number'
              ? extractBudgetValue(parsed.budget)
              : (normalizeBudget(parsed.budget) ?? parsed[key]);
        } else {
          validationData[key] = parsed[key];
        }
      }
    }

    schemaValidator.validateProposalData(proposalTemplate, validationData);
  } else {
    schemaValidator.validateProposalData(proposalTemplate, proposalData);
  }
}
