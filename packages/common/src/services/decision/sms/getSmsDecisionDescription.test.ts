import { TestDecisionsDataManager } from '@op/common/testing';
import { ProcessStatus, ProposalStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { getSmsDecisionDescription } from './getSmsDecisionDescription';

describe.concurrent('getSmsDecisionDescription', () => {
  it('given a published decision with one submitted proposal, when a member asks for it by slug, then they get its name, slug, phase, voting state and ballot count', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
    });
    await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: `Fund the park ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    await expect(
      getSmsDecisionDescription({
        authUserId: setup.user.id,
        decisionSlug: setup.instance.slug,
      }),
    ).resolves.toEqual({
      name: setup.instance.instance.name,
      slug: setup.instance.slug,
      phaseName: 'Initial Phase',
      votingOpen: false,
      proposalCount: 1,
    });
  });

  it('given a decision that is not published, when a member asks for it by slug, then it is not found', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.DRAFT,
    });

    await expect(
      getSmsDecisionDescription({
        authUserId: setup.user.id,
        decisionSlug: setup.instance.slug,
      }),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('given a published decision the caller is not a member of, when they ask for it by slug, then the lookup is refused', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const outsider = await testData.createMemberUser({
      organization: setup.organization,
    });

    await expect(
      getSmsDecisionDescription({
        authUserId: outsider.authUserId,
        decisionSlug: setup.instance.slug,
      }),
    ).rejects.toMatchObject({ name: 'UnauthorizedError' });
  });
});
