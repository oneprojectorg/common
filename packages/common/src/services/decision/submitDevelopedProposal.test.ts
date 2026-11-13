import {
  TestDecisionsDataManager,
  createDevelopPhaseSetup,
  createDevelopProposalsMember,
} from '@op/common/testing';
import { db, eq } from '@op/db/client';
import { ProposalStatus, proposals } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import { createDevelopedProposal } from './createDevelopedProposal';
import { submitDevelopedProposal } from './submitDevelopedProposal';

describe.concurrent('submitDevelopedProposal', () => {
  it('lets the author, a caller with Develop Proposals and no Submit bit, submit the draft', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const developer = await createDevelopProposalsMember({
      testData,
      setup,
    });
    const draft = await createDevelopedProposal({
      data: {
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Developed' },
      },
      user: developer.user,
    });
    testData.trackProfileForCleanup(draft.profileId);

    const submitted = await submitDevelopedProposal({
      data: { proposalId: draft.id },
      user: developer.user,
    });

    expect(submitted.id).toBe(draft.id);
    expect(submitted.status).toBe(ProposalStatus.SUBMITTED);
    expect(submitted.shortCode).not.toBeNull();
  });

  it('refuses a caller with Develop Proposals who is not an author', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const [author, otherDeveloper] = await Promise.all([
      createDevelopProposalsMember({ testData, setup }),
      createDevelopProposalsMember({ testData, setup }),
    ]);
    const draft = await createDevelopedProposal({
      data: {
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Developed' },
      },
      user: author.user,
    });
    testData.trackProfileForCleanup(draft.profileId);

    const error = await submitDevelopedProposal({
      data: { proposalId: draft.id },
      user: otherDeveloper.user,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error).toHaveProperty(
      'message',
      expect.stringContaining('Only an author'),
    );
  });

  it('refuses a draft with no developed edge', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createDevelopPhaseSetup({ testData });
    const ordinaryDraft = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Ordinary' },
    });

    const error = await submitDevelopedProposal({
      data: { proposalId: ordinaryDraft.id },
      user: setup.user,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toHaveProperty(
      'message',
      expect.stringContaining('not developed'),
    );
  });

  it.for([
    { name: 'soft-deleted', column: 'deletedAt' },
    { name: 'moderation-detached', column: 'moderationDetachedAt' },
  ] as const)(
    'refuses a $name developed draft as not found',
    async ({ column }, { task, onTestFinished }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { setup, instanceId, source } = await createDevelopPhaseSetup({
        testData,
      });
      const developer = await createDevelopProposalsMember({
        testData,
        setup,
      });
      const draft = await createDevelopedProposal({
        data: {
          processInstanceId: instanceId,
          sourceProposalIds: [source.id],
          proposalData: { title: 'Developed' },
        },
        user: developer.user,
      });
      testData.trackProfileForCleanup(draft.profileId);
      await db
        .update(proposals)
        .set({ [column]: new Date().toISOString() })
        .where(eq(proposals.id, draft.id));

      const error = await submitDevelopedProposal({
        data: { proposalId: draft.id },
        user: developer.user,
      }).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(NotFoundError);
    },
  );
});
