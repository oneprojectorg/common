import { getTipTapClient } from '@op/collab';
import type { JSONContent } from '@tiptap/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentFetchError, ValidationError } from '../../utils';
import type { ProposalTemplateSchema } from './types';
import { validateProposalAgainstTemplate } from './validateProposalAgainstTemplate';

vi.mock('@op/collab', () => ({
  getTipTapClient: vi.fn(),
}));

vi.mock('./boundaryCategory', () => ({
  fillCategoryFromBoundary: vi.fn(
    async (_template: unknown, data: unknown) => data,
  ),
}));

const template = {
  type: 'object',
  properties: {
    title: { type: 'string', title: 'Proposal title' },
    summary: { type: 'string', title: 'Proposal summary' },
  },
  required: ['title', 'summary'],
} as unknown as ProposalTemplateSchema;

function textDoc(text: string): JSONContent {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

function httpError(status: number): Error & { response: { status: number } } {
  const error = new Error(
    `Request failed with status code ${status}`,
  ) as Error & {
    response: { status: number };
  };
  error.response = { status };
  return error;
}

const getFragments = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  getFragments.mockReset();
  vi.mocked(getTipTapClient).mockReturnValue({
    getDocumentFragments: getFragments,
  } as unknown as ReturnType<typeof getTipTapClient>);
});

describe('validateProposalAgainstTemplate (collab doc)', () => {
  it('treats a 404 from TipTap as an empty document — required errors surface', async () => {
    getFragments.mockRejectedValue(httpError(404));

    const result = validateProposalAgainstTemplate(
      template,
      { collaborationDocId: 'proposal-1' },
      'Some title',
      { profileId: 'profile-1' },
    );

    await expect(result).rejects.toThrow(ValidationError);
    await expect(result).rejects.toThrow(/is required/);
  });

  it('throws DocumentFetchError (not ValidationError) when TipTap returns 500', async () => {
    getFragments.mockRejectedValue(httpError(500));

    const result = validateProposalAgainstTemplate(
      template,
      { collaborationDocId: 'proposal-1' },
      'Some title',
      { profileId: 'profile-1' },
    );

    await expect(result).rejects.toBeInstanceOf(DocumentFetchError);
    await expect(result).rejects.not.toThrow(ValidationError);
  });

  it('throws DocumentFetchError on non-HTTP failures (e.g. timeout)', async () => {
    getFragments.mockRejectedValue(
      new Error('TimeoutError: request timed out'),
    );

    const result = validateProposalAgainstTemplate(
      template,
      { collaborationDocId: 'proposal-1' },
      'Some title',
      { profileId: 'profile-1' },
    );

    await expect(result).rejects.toBeInstanceOf(DocumentFetchError);
  });

  it('validates successfully when the fragments hold the required values', async () => {
    getFragments.mockResolvedValue({
      title: textDoc('A title'),
      summary: textDoc('A summary'),
    });

    // No title param: the fragment value is used. (When a title IS passed,
    // it overrides the fragment — submitProposal passes the DB-stored
    // profile.name, which autosave keeps current.)
    const result = await validateProposalAgainstTemplate(
      template,
      { collaborationDocId: 'proposal-1' },
      undefined,
      { profileId: 'profile-1' },
    );

    expect(result).toEqual(
      expect.objectContaining({
        title: 'A title',
        summary: 'A summary',
      }),
    );
  });
});
