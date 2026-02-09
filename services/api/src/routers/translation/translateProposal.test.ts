import { mockCollab } from '@op/collab/testing';
import { describe, expect, it, vi } from 'vitest';

import { appRouter } from '..';
import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

// Set a fake API key so the endpoint doesn't throw before reaching the mock
process.env.DEEPL_API_KEY = 'test-fake-key';

// Spy on translateText so we can assert what was sent to DeepL
const mockTranslateText = vi.fn((texts: string[]) =>
  texts.map((t) => ({
    text: `[ES] ${t}`,
    detectedSourceLang: 'en',
  })),
);

// Mock deepl-node so we never hit the real API
vi.mock('deepl-node', () => ({
  DeepLClient: class {
    translateText = mockTranslateText;
  },
}));

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

describe.concurrent('translation.translateProposal', () => {
  it('should translate proposal title', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // Create proposal with collaborationDocId (no description → keeps the doc)
    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Community Garden Project' },
    });

    // Set up a mock TipTap document for the collaboration doc
    const { collaborationDocId } = proposal.proposalData as {
      collaborationDocId: string;
    };
    mockCollab.setDocResponse(collaborationDocId, {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'A proposal for a garden' }],
        },
      ],
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.translation.translateProposal({
      profileId: proposal.profileId,
      targetLocale: 'ES',
    });

    expect(result).toEqual({
      targetLocale: 'ES',
      sourceLocale: 'EN',
      translated: {
        title: '[ES] Community Garden Project',
        default: '[ES] <p>A proposal for a garden</p>',
      },
    });

    // Verify what was sent to DeepL
    expect(mockTranslateText).toHaveBeenCalledWith(
      ['Community Garden Project', '<p>A proposal for a garden</p>'],
      null,
      'ES',
      expect.objectContaining({ tagHandling: 'html' }),
    );
  });
});
