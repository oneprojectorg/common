import { getTipTapClient } from '@op/collab';
import type { JSONContent } from '@tiptap/core';

import {
  assembleProposalData,
  toValidationBudget,
} from './assembleProposalData';
import { fillCategoryFromBoundary } from './boundaryCategory';
import { getFragmentTextFromTipTapDoc } from './getFragmentTextFromTipTapDoc';
import { getProposalFragmentNames } from './getProposalFragmentNames';
import {
  parseProposalData,
  parseStoredBudgetFragmentValue,
} from './proposalDataSchema';
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
    // Whether the document holds a budget at all, read with the same parser
    // `assembleProposalData` used. Not `assembledData.budget === undefined`:
    // an unreadable fragment lands there as its raw *text*, so that test read
    // "the document has a budget" for text no reader can make a budget out of.
    const fragmentBudget = parseStoredBudgetFragmentValue(
      fragmentTexts.budget ?? '',
    );
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
      // An unreadable fragment means "unknown", not "the author cleared it",
      // exactly as it does for display (`resolveSystemFieldOverrides`) and for
      // the editor's autosave — so the row still backfills. Gating this on the
      // *assembled* value instead left the raw fragment text in front of an
      // object-typed budget schema, and a proposal whose row held a perfectly
      // good budget could not be submitted at all while the editor showed the
      // same fragment as "Add budget".
      //
      // Shaped for the template, not handed over as parsed: legacy templates
      // declare the budget as `{type: 'number'}`, and AJV runs with
      // `coerceTypes: false`, so injecting the parsed `{amount, currency}`
      // object failed validation outright — the author saw "Budget is invalid"
      // and could not submit at all. An unreadable stored budget goes through
      // raw so it fails on its own merits rather than reading as absent.
      //
      // `!= null` rather than `!== undefined`: `budgetValueSchema` is
      // `.nullish()`, so `updateProposal` writes a literal `budget: null` into
      // the column for a proposal whose budget was cleared. That is not a
      // budget to backfill — injecting it put `null` in front of both budget
      // schemas, and an author with an optional, deliberately empty budget
      // could not submit at all.
      ...(fragmentBudget === undefined && storedProposalData.budget != null
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
