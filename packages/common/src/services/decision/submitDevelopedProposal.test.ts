import {
  TestDecisionsDataManager,
  createDevelopPhaseReviewer,
  createDevelopPhaseSetup,
} from '@op/common/testing';
import { ProposalStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { UnauthorizedError, ValidationError } from '../../utils';
import { createDevelopedProposal } from './createDevelopedProposal';
import { submitDevelopedProposal } from './submitDevelopedProposal';

describe.concurrent('submitDevelopedProposal', () => {
  it('lets the author, a category reviewer with Review and no Submit bit, submit the draft', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const reviewer = await createDevelopPhaseReviewer({
      testData,
      setup,
      onTestFinished,
    });
    const draft = await createDevelopedProposal({
      data: {
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Developed' },
      },
      user: reviewer.user,
    });
    testData.trackProfileForCleanup(draft.profileId);

    const submitted = await submitDevelopedProposal({
      data: { proposalId: draft.id },
      user: reviewer.user,
    });

    expect(submitted.id).toBe(draft.id);
    expect(submitted.status).toBe(ProposalStatus.SUBMITTED);
    expect(submitted.shortCode).not.toBeNull();
  });

  it('refuses a category reviewer with a row who is not an author', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const [author, otherReviewer] = await Promise.all([
      createDevelopPhaseReviewer({ testData, setup, onTestFinished }),
      createDevelopPhaseReviewer({ testData, setup, onTestFinished }),
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
      user: otherReviewer.user,
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
});
