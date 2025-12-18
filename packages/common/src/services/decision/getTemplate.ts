import { simpleVoting } from '../../lib/decisionSchemas/definitions';

/**
 * Fetches a decision template by ID and validates its schema.
 * Returns the hardcoded 'simple' template if requested, otherwise fetches from database.
 */
export const getTemplate = async (_templateId: string) => {
  // TODO: this will query the DB but for now just returns the simple template. Returning an async function in prep
  return simpleVoting;
};
