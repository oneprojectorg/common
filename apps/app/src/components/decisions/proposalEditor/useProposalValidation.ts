import {
  type SchemaValidationResult,
  assembleProposalData,
  getProposalFragmentNames,
  schemaValidator,
} from '@op/common/client';
import { useCallback } from 'react';
import type { Doc } from 'yjs';

import type { ProposalTemplateSchema } from './compileProposalSchema';

/**
 * Reads plain text from Yjs XmlFragments for each template field.
 *
 * This is the client-side equivalent of fetching fragment text via
 * TipTap Cloud REST API with `format=text`. Both produce the same
 * plain-text representation that `assembleProposalData` expects.
 */
function extractFragmentTexts(
  ydoc: Doc,
  fragmentNames: string[],
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const name of fragmentNames) {
    const text = ydoc.getXmlFragment(name).toString().trim();
    if (text) {
      result[name] = text;
    }
  }

  return result;
}

/**
 * Client-side proposal validation against the JSON Schema template.
 *
 * Reads all field values from the Yjs document, assembles them into
 * the data shape the schema validator expects, and validates against
 * the same JSON Schema used by the backend. This gives immediate
 * feedback without a server round-trip.
 *
 * @param ydoc - The shared Yjs document from `useCollaborativeDoc()`.
 * @param template - The proposal template schema from the process instance.
 * @returns An object with a `validate` function that returns
 *   `{ valid, errors }` matching the backend's `SchemaValidationResult`.
 */
export function useProposalValidation(
  ydoc: Doc,
  template: ProposalTemplateSchema,
): { validate: () => SchemaValidationResult } {
  const validate = useCallback((): SchemaValidationResult => {
    const fragmentNames = getProposalFragmentNames(template);
    const fragmentTexts = extractFragmentTexts(ydoc, fragmentNames);
    const data = assembleProposalData(template, fragmentTexts);
    return schemaValidator.validate(template, data);
  }, [ydoc, template]);

  return { validate };
}
