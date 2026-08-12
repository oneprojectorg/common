import { getTipTapClient } from '@op/collab';
import type { JSONContent } from '@tiptap/core';

import {
  assembleProposalData,
  toValidationBudget,
} from './assembleProposalData';
import { fillCategoryFromBoundary } from './boundaryCategory';
import { getFragmentTextFromTipTapDoc } from './getFragmentTextFromTipTapDoc';
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
  title: string | undefined,
  { profileId }: { profileId: string },
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
    // Fetch JSON and extract text via `getFragmentTextFromTipTapDoc` so the
    // server reads the fragment exactly as the client's `getFragmentPlainText`
    // does. TipTap's own `format=text` endpoint serializes through ProseMirror
    // and doesn't round-trip whitespace baked into dropdown option consts,
    // which breaks AJV's strict `oneOf` match. See ONE-289.
    //
    // A 404 from TipTap means the collab doc hasn't been written yet (e.g.
    // the user opened the editor but never typed). Treat that as "all
    // fragments empty" so the validator surfaces required-field errors
    // instead of leaking an HTTP error.
    const fragmentDocs = await client
      .getDocumentFragments(parsed.collaborationDocId, fragmentNames)
      .catch(() => ({}) as Record<string, never>);
    const fragmentTexts: Record<string, string> = Object.fromEntries(
      fragmentNames.map((name) => [
        name,
        getFragmentTextFromTipTapDoc(fragmentDocs[name] as JSONContent),
      ]),
    );
    const assembledData = assembleProposalData(proposalTemplate, fragmentTexts);
    const validationData = {
      ...assembledData,
      ...(storedProposalData.category !== undefined
        ? { category: storedProposalData.category }
        : {}),
      // Backfill only — the fragment outranks the row wherever it holds a
      // budget, because that is what the author sees and what the client's
      // `useProposalValidation` checks. Overriding it with the row instead
      // rejected on submit a budget the form had just called valid (the row can
      // still hold a creation-time amount the author has since edited down),
      // leaving no edit that clears the error.
      //
      // Shaped for the template, not handed over as parsed: legacy templates
      // declare the budget as `{type: 'number'}`, and AJV runs with
      // `coerceTypes: false`, so injecting the parsed `{amount, currency}`
      // object failed validation outright — the author saw "Budget is invalid"
      // and could not submit at all. An unreadable stored budget goes through
      // raw so it fails on its own merits rather than reading as absent.
      ...(assembledData.budget === undefined &&
      storedProposalData.budget !== undefined
        ? {
            budget: parsed.budget
              ? toValidationBudget(
                  proposalTemplate.properties?.budget,
                  parsed.budget,
                )
              : storedProposalData.budget,
          }
        : {}),
      ...(shouldInjectTitle ? { title } : {}),
    };

    // Auto-fill the council-district category from the location's boundary
    // before validating — the server-side replacement for the former
    // client-side auto-select. From here on the district is a normal category.
    const finalData = await fillCategoryFromBoundary(
      proposalTemplate,
      validationData,
      { profileId },
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
