/**
 * Tests for getProposal with documentContent integration.
 *
 * documentContent is a discriminated union:
 * - { type: 'json', content: unknown[] } for TipTap collaborative documents
 * - { type: 'html', content: string } for legacy HTML/text descriptions
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

// Mock TipTap document responses by docId - concurrent-safe
const docResponses = new Map<string, () => Promise<unknown>>();
const setDocResponse = (docId: string, data: unknown) => {
  docResponses.set(docId, () => Promise.resolve(data));
};

vi.mock('@op/collab', () => ({
  createTipTapClient: () => ({
    getDocument: (docName: string) => {
      const handler = docResponses.get(docName);
      if (handler) {
        return handler();
      }
      return Promise.reject(new Error('404 Not Found'));
    },
  }),
}));

afterEach(() => {
  docResponses.clear();
});

describe.concurrent('getProposal documentContent', () => {
  it('should return json documentContent when collaborationDocId exists and doc is fetched', async ({
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
        description: 'Fallback description',
        collaborationDocId,
      } as { title: string; description: string },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.getProposal({
      profileId: proposal.profileId,
    });

    expect(result.proposalData).toMatchObject({
      title: 'TipTap Test Proposal',
      collaborationDocId,
    });
    expect(result.documentContent).toEqual({
      type: 'json',
      content: mockTipTapContent.content,
    });
  });

  it('should return undefined documentContent when TipTap returns 404', async ({
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
    const result = await caller.decision.getProposal({
      profileId: proposal.profileId,
    });

    expect(result.proposalData).toMatchObject({
      title: 'Missing Doc Proposal',
      collaborationDocId,
    });
    // When TipTap fetch fails, documentContent is undefined (UI handles error state)
    expect(result.documentContent).toBeUndefined();
  });

  it('should return undefined documentContent on TipTap timeout', async ({
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
    const result = await caller.decision.getProposal({
      profileId: proposal.profileId,
    });

    expect(result.proposalData).toMatchObject({
      title: 'Timeout Test Proposal',
      collaborationDocId,
    });
    expect(result.documentContent).toBeUndefined();
  });

  it('should return html documentContent for legacy proposals with description', async ({
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
        description: '<p>This is <strong>HTML</strong> content</p>',
      },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.getProposal({
      profileId: proposal.profileId,
    });

    expect(result.proposalData).toMatchObject({
      title: 'Legacy Proposal',
      description: '<p>This is <strong>HTML</strong> content</p>',
    });
    expect(result.documentContent).toEqual({
      type: 'html',
      content: '<p>This is <strong>HTML</strong> content</p>',
    });
  });

  it('should return undefined documentContent when description is empty', async ({
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
        title: 'Title Only Proposal',
        description: '', // Empty description = no content
      },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.getProposal({
      profileId: proposal.profileId,
    });

    expect(result.proposalData).toMatchObject({
      title: 'Title Only Proposal',
    });
    expect(result.documentContent).toBeUndefined();
  });
});
