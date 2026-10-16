import { TestDecisionsDataManager } from '@op/common/testing';
import { ProcessStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { getPublishedDecisionBySlug } from './getPublishedDecisionBySlug';

describe.concurrent('getPublishedDecisionBySlug', () => {
  it('given a published decision, when a member looks it up by slug, then it is returned with its current phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
    });

    await expect(
      getPublishedDecisionBySlug({
        authUserId: setup.user.id,
        slug: setup.instance.slug,
      }),
    ).resolves.toMatchObject({
      processInstanceId: setup.instance.instance.id,
      slug: setup.instance.slug,
      currentPhase: { phaseId: setup.instance.instance.currentStateId },
    });
  });

  it('given a decision that is not published, when a member looks it up by slug, then it is not found', async ({
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
      getPublishedDecisionBySlug({
        authUserId: setup.user.id,
        slug: setup.instance.slug,
      }),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('given a published decision the caller is not a member of, when they look it up by slug, then the lookup is refused', async ({
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
      getPublishedDecisionBySlug({
        authUserId: outsider.authUserId,
        slug: setup.instance.slug,
      }),
    ).rejects.toMatchObject({ name: 'UnauthorizedError' });
  });
});
