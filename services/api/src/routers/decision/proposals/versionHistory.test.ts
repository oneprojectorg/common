import { mockCollab, textFragment } from '@op/collab/testing';
import { profiles, proposals } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

const proposalTemplate = {
  type: 'object',
  required: ['title', 'summary'],
  'x-field-order': ['title', 'category', 'budget', 'summary'],
  properties: {
    title: {
      type: 'string',
      title: 'Proposal title',
      'x-format': 'short-text',
    },
    category: {
      type: ['string', 'null'],
      title: 'Category',
      'x-format': 'dropdown',
      oneOf: [
        { const: 'Food Access', title: 'Food Access' },
        { const: 'Housing', title: 'Housing' },
        { const: null, title: '' },
      ],
    },
    budget: {
      type: 'object',
      title: 'Budget',
      'x-format': 'money',
      properties: {
        amount: { type: 'number' },
        currency: { type: 'string', default: 'USD' },
      },
    },
    summary: {
      type: 'string',
      title: 'Summary',
      'x-format': 'long-text',
    },
  },
} as const;

const versionOneFragments = {
  title: textFragment('Version 1 title'),
  category: textFragment('Food Access'),
  budget: textFragment(JSON.stringify({ amount: 2500, currency: 'USD' })),
  summary: textFragment('Summary from version 1'),
};

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

function createTestDataManager(taskId: string) {
  const noopOnTestFinished: (fn: () => void | Promise<void>) => void = () =>
    undefined;

  return new TestDecisionsDataManager(taskId, noopOnTestFinished);
}

describe('proposal version history', () => {
  it('should return an empty version list when no saved versions exist yet', async ({
    task,
  }) => {
    const testData = createTestDataManager(task.id);

    try {
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
        proposalTemplate,
      });

      const instance = setup.instances[0];
      if (!instance) {
        throw new Error('No instance created');
      }

      const proposal = await testData.createProposal({
        callerEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Current proposal' },
      });

      const caller = await createAuthenticatedCaller(setup.userEmail);
      const result = await caller.decision.listProposalVersions({
        proposalId: proposal.id,
      });

      expect(result).toEqual({
        versions: [],
        latestVersion: null,
      });
    } finally {
      await testData.cleanup();
    }
  });

  it('should list proposal versions newest first', async ({ task }) => {
    const testData = createTestDataManager(task.id);

    try {
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
        proposalTemplate,
      });

      const instance = setup.instances[0];
      if (!instance) {
        throw new Error('No instance created');
      }

      const proposal = await testData.createProposal({
        callerEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Current proposal' },
      });

      mockCollab.setVersions(`proposal-${proposal.id}`, [
        { version: 1, date: 1_700_000_000_000, name: 'Version 1' },
        { version: 3, date: 1_700_000_200_000, name: 'Version 3' },
        { version: 2, date: 1_700_000_100_000, name: 'Version 2' },
      ]);

      const caller = await createAuthenticatedCaller(setup.userEmail);
      const result = await caller.decision.listProposalVersions({
        proposalId: proposal.id,
      });

      expect(result.latestVersion).toBe(3);
      expect(result.versions.map((version) => version.version)).toEqual([
        3, 2, 1,
      ]);
    } finally {
      await testData.cleanup();
    }
  });

  it('should return a proposal version preview with assembled proposal data', async ({
    task,
  }) => {
    const testData = createTestDataManager(task.id);

    try {
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
        proposalTemplate,
      });

      const instance = setup.instances[0];
      if (!instance) {
        throw new Error('No instance created');
      }

      const proposal = await testData.createProposal({
        callerEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Current proposal' },
      });

      mockCollab.setVersions(`proposal-${proposal.id}`, [
        { version: 1, date: 1_700_000_000_000, name: 'Version 1' },
      ]);
      mockCollab.setVersionResponse(
        `proposal-${proposal.id}`,
        1,
        versionOneFragments,
      );

      const caller = await createAuthenticatedCaller(setup.userEmail);
      const result = await caller.decision.getProposalVersion({
        proposalId: proposal.id,
        versionId: 1,
      });

      expect(result.version).toMatchObject({
        version: 1,
        name: 'Version 1',
      });
      expect(result.proposalData).toMatchObject({
        title: 'Version 1 title',
        category: 'Food Access',
        budget: { amount: 2500, currency: 'USD' },
        summary: 'Summary from version 1',
      });
      expect(result.documentContent).toMatchObject({
        type: 'json',
        fragments: {
          summary: {
            type: 'doc',
          },
        },
      });
    } finally {
      await testData.cleanup();
    }
  });

  it('should restore a saved version and sync system fields back to the database', async ({
    task,
  }) => {
    const testData = createTestDataManager(task.id);

    try {
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
        proposalTemplate,
      });

      const instance = setup.instances[0];
      if (!instance) {
        throw new Error('No instance created');
      }

      const proposal = await testData.createProposal({
        callerEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Current proposal' },
      });

      await db
        .update(proposals)
        .set({
          proposalData: {
            ...proposal.proposalData,
            category: 'Housing',
            budget: { amount: 9000, currency: 'USD' },
          },
        })
        .where(eq(proposals.id, proposal.id));

      mockCollab.setVersions(`proposal-${proposal.id}`, [
        { version: 1, date: 1_700_000_000_000, name: 'Version 1' },
        { version: 2, date: 1_700_000_100_000, name: 'Version 2' },
      ]);
      mockCollab.setVersionResponse(
        `proposal-${proposal.id}`,
        1,
        versionOneFragments,
      );

      const caller = await createAuthenticatedCaller(setup.userEmail);
      const result = await caller.decision.restoreProposalVersion({
        proposalId: proposal.id,
        versionId: 1,
      });

      expect(result.profile.name).toBe('Version 1 title');
      expect(result.proposalData).toMatchObject({
        category: 'Food Access',
        budget: { amount: 2500, currency: 'USD' },
      });
      expect(result.documentContent).toMatchObject({
        type: 'json',
        fragments: {
          summary: {
            type: 'doc',
          },
        },
      });

      const storedProposal = await db._query.proposals.findFirst({
        where: eq(proposals.id, proposal.id),
      });
      const storedProfile = await db._query.profiles.findFirst({
        where: eq(profiles.id, proposal.profileId),
      });

      expect(storedProposal?.proposalData).toMatchObject({
        category: 'Food Access',
        budget: { amount: 2500, currency: 'USD' },
      });
      expect(storedProfile?.name).toBe('Version 1 title');
    } finally {
      await testData.cleanup();
    }
  });

  it('should reject version history access for non-editors', async ({
    task,
  }) => {
    const testData = createTestDataManager(task.id);

    try {
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
        proposalTemplate,
      });

      const instance = setup.instances[0];
      if (!instance) {
        throw new Error('No instance created');
      }

      const proposal = await testData.createProposal({
        callerEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Current proposal' },
      });

      const memberUser = await testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [],
      });
      const caller = await createAuthenticatedCaller(memberUser.email);

      await expect(
        caller.decision.listProposalVersions({
          proposalId: proposal.id,
        }),
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    } finally {
      await testData.cleanup();
    }
  });
});
