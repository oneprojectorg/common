import { TestDecisionsDataManager } from '@op/common/testing';
import { encodeErrorDigest } from '@op/core';
import { describe, expect, it } from 'vitest';

import { createCallerForRequest } from './serverClient';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from './test/supabase-utils';

/** The caller a Server Component gets for a signed-in user's request. */
const createCallerAs = async (email: string) => {
  const { session } = await createIsolatedSession(email);
  return createCallerForRequest(await createTestContextWithSession(session));
};

describe.concurrent('createCallerForRequest', () => {
  it('carries a 403 on the digest when the caller may not read the decision', async ({
    task,
    onTestFinished,
  }) => {
    // Given a decision and a confirmed user who is not a member of it
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: false,
    });
    const nonMember = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });
    const caller = await createCallerAs(nonMember.email);

    // When the server component loads the decision for that user
    const call = caller.decision.getDecisionBySlug({
      slug: setup.instance.slug,
    });

    // Then the error still throws, and its digest says 403, not 500
    await expect(call).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError', statusCode: 403 },
      digest: encodeErrorDigest({
        statusCode: 403,
        name: 'UnauthorizedError',
      }),
    });
  });

  it('returns the decision to its admin', async ({ task, onTestFinished }) => {
    // Given a decision and its admin
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const caller = await createCallerAs(setup.userEmail);

    // When the server component loads the decision for the admin
    const decision = await caller.decision.getDecisionBySlug({
      slug: setup.instance.slug,
    });

    // Then the call succeeds with admin access
    expect(decision.slug).toBe(setup.instance.slug);
    expect(decision.processInstance.access?.admin).toBe(true);
  });
});
