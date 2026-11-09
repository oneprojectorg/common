import { mockCollab } from '@op/collab/testing';
import { db, eq } from '@op/db/client';
import { formSchemas, proposals } from '@op/db/schema';

/** The instance template: requires a summary, knows nothing of a ballot description. */
export const instanceTemplate = {
  type: 'object',
  required: ['title', 'summary'],
  'x-field-order': ['title', 'summary'],
  properties: {
    title: { type: 'string', title: 'Title', 'x-format': 'short-text' },
    summary: { type: 'string', title: 'Summary', 'x-format': 'long-text' },
  },
};

/** A form schema row's schema: requires a ballot description, has no summary. */
export const entrySchema = {
  type: 'object',
  required: ['title', 'ballotDescription'],
  'x-field-order': ['title', 'ballotDescription'],
  properties: {
    title: { type: 'string', title: 'Title', 'x-format': 'short-text' },
    ballotDescription: {
      type: 'string',
      title: 'Ballot description',
      maxLength: 280,
      'x-format': 'long-text',
    },
  },
};

/** Inserts a `decision_form_schemas` row; the prototype has no write path. */
export async function insertFormSchema(values: {
  processInstanceId: string;
  name: string;
  schema: Record<string, unknown>;
  parentId?: string;
}) {
  const [row] = await db.insert(formSchemas).values(values).returning();
  if (!row) {
    throw new Error('form schema insert returned no row');
  }
  return row;
}

/** Points a proposal at a form schema row, as a manual insert would. */
export async function attachFormSchema(
  proposalId: string,
  formSchemaId: string,
): Promise<void> {
  await db
    .update(proposals)
    .set({ formSchemaId })
    .where(eq(proposals.id, proposalId));
}

/**
 * Points the proposal at its collaboration document and seeds the document's
 * fragments and versions, so submit validates the fragments against the
 * proposal's template.
 */
export async function seedCollabFragments(
  proposalId: string,
  fragments: Record<string, string>,
): Promise<void> {
  const collaborationDocId = `proposal-${proposalId}`;

  await db
    .update(proposals)
    .set({ proposalData: { ...fragments, collaborationDocId } })
    .where(eq(proposals.id, proposalId));

  mockCollab.setDocFragments(collaborationDocId, fragments);
  mockCollab.setVersions(collaborationDocId, [
    { version: 1, createdAt: '2026-03-18T08:50:00.000Z' },
  ]);
}
