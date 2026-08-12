import type { JSONContent } from '@tiptap/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProposalTemplateSchema } from './types';

const fragments = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));

vi.mock('@op/collab', () => ({
  getTipTapClient: () => ({
    getDocumentFragments: async () => fragments.current,
  }),
}));

// The boundary fill is a DB round-trip and orthogonal to what these tests
// check; pass the assembled data straight through.
vi.mock('./boundaryCategory', () => ({
  fillCategoryFromBoundary: async (
    _template: unknown,
    data: Record<string, unknown>,
  ) => data,
}));

const { validateProposalAgainstTemplate } =
  await import('./validateProposalAgainstTemplate');

/** A fragment document holding a single line of text, as TipTap returns it. */
const textFragment = (text: string): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

/** Legacy shape: the budget is declared as a bare number. */
const template: ProposalTemplateSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', 'x-format': 'short-text' },
    budget: { type: 'number', 'x-format': 'money', maximum: 10000 },
  },
};

/** Canonical shape, as the process builder writes it. */
const objectTemplate: ProposalTemplateSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', 'x-format': 'short-text' },
    budget: {
      type: 'object',
      'x-format': 'money',
      properties: {
        amount: { type: 'number' },
        currency: { type: 'string', default: 'USD' },
      },
    },
  },
};

const validateWith = (
  proposalTemplate: ProposalTemplateSchema,
  proposalData: unknown,
) =>
  validateProposalAgainstTemplate(
    proposalTemplate,
    proposalData,
    'A proposal',
    { profileId: 'profile-1' },
  );

const validate = (proposalData: unknown) =>
  validateWith(template, proposalData);

beforeEach(() => {
  fragments.current = {};
});

describe('validateProposalAgainstTemplate budget', () => {
  it('validates the fragment budget over the one stored on the row', async () => {
    // The row can still hold a creation-time amount the author has since
    // edited down. The client validates the fragment, so validating the row
    // here rejected on submit a budget the form had just called valid, with no
    // edit that could clear the error.
    fragments.current = { budget: textFragment('5000') };

    await expect(
      validate({
        collaborationDocId: 'doc-1',
        budget: { amount: 50000, currency: 'USD' },
      }),
    ).resolves.toMatchObject({ budget: 5000 });
  });

  it('falls back to the stored budget when the fragment holds none', async () => {
    // Legacy proposals keep their budget on the row alone; without the
    // backfill a template that requires one would reject them as empty.
    fragments.current = {};

    await expect(
      validate({
        collaborationDocId: 'doc-1',
        budget: { amount: 5000, currency: 'USD' },
      }),
    ).resolves.toMatchObject({ budget: 5000 });
  });

  it('falls back to the stored budget when the fragment is unreadable', async () => {
    // Free text an author or an import left in the fragment ("TBD", "5,000")
    // is "we don't know", not "there is no budget": handing it to AJV as a
    // string rejected the whole proposal on submit, with nothing on screen
    // looking wrong — the editor reads the same fragment as "Add budget".
    fragments.current = { budget: textFragment('TBD') };

    await expect(
      validateWith(objectTemplate, {
        collaborationDocId: 'doc-1',
        budget: { amount: 5000, currency: 'USD' },
      }),
    ).resolves.toMatchObject({ budget: { amount: 5000, currency: 'USD' } });
  });

  it('rejects an unreadable fragment when the row holds no budget either', async () => {
    fragments.current = { budget: textFragment('TBD') };

    await expect(
      validateWith(objectTemplate, { collaborationDocId: 'doc-1' }),
    ).rejects.toThrow();
  });

  it('rejects a fragment budget over the template maximum', async () => {
    fragments.current = { budget: textFragment('50000') };

    await expect(
      validate({ collaborationDocId: 'doc-1', budget: { amount: 5000 } }),
    ).rejects.toThrow();
  });
});
