/**
 * Tests for getProposal with TipTap content integration.
 *
 * NOTE: These tests will FAIL until common-vcd.6 is implemented.
 * They serve as a specification for the expected behavior.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/** Type for result with tiptapContent (will exist after vcd.6 integration) */
type ProposalResultWithTipTap = Awaited<
  ReturnType<
    Awaited<
      ReturnType<typeof createAuthenticatedCaller>
    >['decision']['getProposal']
  >
> & {
  tiptapContent?: { type: string; content?: unknown[] };
};

// Mock TipTap document responses by docId - concurrent-safe
const docResponses = new Map<string, () => Promise<unknown>>();
const setDocResponse = (docId: string, data: unknown) => {
  docResponses.set(docId, () => Promise.resolve(data));
};

vi.mock('@op/collab', () => ({
  createTipTapClient: () => ({
    getDocument: (docName: string) => {
      const handler = docResponses.get(docName);
      if (handler) return handler();
      return Promise.reject(new Error('404 Not Found'));
    },
  }),
}));

afterEach(() => {
  docResponses.clear();
});

describe.concurrent('getProposal with TipTap content', () => {
  it.only('should return tiptapContent when proposal has collaborationDocId and doc exists', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const collaborationDocId = `proposal-${instance.instance.id}-test-doc-123`;
    const mockTipTapContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Rich content from TipTap Cloud' }],
        },
      ],
    };
    setDocResponse(collaborationDocId, mockTipTapContent);

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: {
        title: 'TipTap Test Proposal',
        description: 'Initial description',
        collaborationDocId,
      } as { title: string; description: string },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = (await caller.decision.getProposal({
      profileId: proposal.profileId,
    })) as ProposalResultWithTipTap;

    expect(result.proposalData).toMatchObject({
      title: 'TipTap Test Proposal',
      collaborationDocId,
    });
    expect(result.tiptapContent).toEqual(mockTipTapContent);
  });

  it('should return undefined tiptapContent when doc returns 404', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const collaborationDocId = `proposal-${instance.instance.id}-nonexistent`;

    // 404 is the default behavior when docId not in docResponses

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: {
        title: 'Missing Doc Proposal',
        description: 'Has docId but doc does not exist',
        collaborationDocId,
      } as { title: string; description: string },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = (await caller.decision.getProposal({
      profileId: proposal.profileId,
    })) as ProposalResultWithTipTap;

    expect(result.proposalData).toMatchObject({
      title: 'Missing Doc Proposal',
      collaborationDocId,
    });
    expect(result.tiptapContent).toBeUndefined();
  });

  it('should return undefined tiptapContent on timeout (silent failure)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const collaborationDocId = `proposal-${instance.instance.id}-timeout-doc`;

    const timeoutError = new Error('Request timed out');
    timeoutError.name = 'TimeoutError';
    docResponses.set(collaborationDocId, () => Promise.reject(timeoutError));

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: {
        title: 'Timeout Test Proposal',
        description: 'Doc fetch will timeout',
        collaborationDocId,
      } as { title: string; description: string },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = (await caller.decision.getProposal({
      profileId: proposal.profileId,
    })) as ProposalResultWithTipTap;

    expect(result.proposalData).toMatchObject({
      title: 'Timeout Test Proposal',
      collaborationDocId,
    });
    expect(result.tiptapContent).toBeUndefined();
  });

  it('should not fetch TipTap content when proposal has no collaborationDocId', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: {
        title: 'Legacy Proposal',
        description: 'No TipTap integration',
      },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = (await caller.decision.getProposal({
      profileId: proposal.profileId,
    })) as ProposalResultWithTipTap;

    expect(result.proposalData).toMatchObject({
      title: 'Legacy Proposal',
      description: 'No TipTap integration',
    });
    expect(result.tiptapContent).toBeUndefined();
    // No docResponses entry needed - getDocument should not be called at all
  });
});
