import {
  type SchemaValidationResult,
  assembleProposalData,
  getProposalFragmentNames,
  schemaValidator,
} from '@op/common/client';
import { useCallback } from 'react';
import * as Y from 'yjs';
import type { Doc } from 'yjs';

import type { ProposalTemplateSchema } from './compileProposalSchema';

/**
 * Recursively extracts the text content from an XmlElement,
 * concatenating all nested XmlText children (ignoring markup).
 */
function getBlockText(element: Y.XmlElement): string {
  const parts: string[] = [];
  element.forEach((child) => {
    if (child instanceof Y.XmlText) {
      parts.push(child.toJSON());
    } else if (child instanceof Y.XmlElement) {
      parts.push(getBlockText(child));
    }
  });
  return parts.join('');
}

/**
 * Extracts plain text from a Yjs XmlFragment, matching the output of
 * TipTap Cloud REST API with `format=text`.
 *
 * All fragment content (both TipTap editor fields and scalar values from
 * `useCollaborativeFragment`) is stored as paragraph-wrapped `XmlElement`
 * nodes. Each element is recursively walked to concatenate its text,
 * then blocks are joined with newlines.
 */
function getFragmentPlainText(fragment: Y.XmlFragment): string {
  const blocks: string[] = [];
  fragment.forEach((node) => {
    if (node instanceof Y.XmlElement) {
      blocks.push(getBlockText(node));
    }
  });
  return blocks.join('\n').trim();
}

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
    const text = getFragmentPlainText(ydoc.getXmlFragment(name));
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
