import { TestDecisionsDataManager } from '@op/common/testing';
import { ProcessStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { findPublishedDecisionBySlug } from './findPublishedDecisionBySlug';

describe.concurrent('findPublishedDecisionBySlug', () => {
  it('given a published decision, when a member looks it up by slug, then it is found with its current phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
    });

    const decision = await findPublishedDecisionBySlug({
      authUserId: setup.user.id,
      slug: setup.instance.slug,
    });

    expect(decision).toMatchObject({
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

    const decision = await findPublishedDecisionBySlug({
      authUserId: setup.user.id,
      slug: setup.instance.slug,
    });

    expect(decision).toBeNull();
  });

  it('given a published decision the caller is not a member of, when they look it up by slug, then it is not found', async ({
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

    const decision = await findPublishedDecisionBySlug({
      authUserId: outsider.authUserId,
      slug: setup.instance.slug,
    });

    expect(decision).toBeNull();
  });
});
