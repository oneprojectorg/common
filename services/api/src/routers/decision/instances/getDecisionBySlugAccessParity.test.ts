import { TestDecisionsDataManager } from '@op/common/testing';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
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

/**
 * /overview is single-fetch: it reads per-user `access` from getDecisionBySlug
 * instead of getInstance, so the two must agree on the capabilities the
 * overview gates on (admin, submitProposals).
 */
describe.concurrent('getDecisionBySlug access parity with getInstance', () => {
  it('admin user: access matches getInstance for overview-gated fields', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // grantAccess: true assigns the default Admin role (profile.ADMIN + full
    // decisions bits).
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const [bySlug, byInstance] = await Promise.all([
      caller.decision.getDecisionBySlug({ slug: setup.instance.slug }),
      caller.decision.getInstance({
        instanceId: setup.instance.instance.id,
      }),
    ]);

    const slugAccess = bySlug.processInstance.access;
    const instanceAccess = byInstance.access;

    // The fields /overview reads: admin (phase-advance + header chrome) and
    // submitProposals (Submit CTA). read/vote included for completeness.
    expect(slugAccess?.admin).toBe(instanceAccess?.admin);
    expect(slugAccess?.submitProposals).toBe(instanceAccess?.submitProposals);
    expect(slugAccess?.read).toBe(instanceAccess?.read);
    expect(slugAccess?.vote).toBe(instanceAccess?.vote);

    // And concretely: an admin can submit + administer.
    expect(slugAccess?.admin).toBe(true);
    expect(slugAccess?.submitProposals).toBe(true);
  });

  it('profile admin without the decisions ADMIN bit: both report admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const profileAdmin = await testData.createProfileAdminUser({
      organization: setup.organization,
      instanceProfileId: setup.instance.profileId,
    });
    const caller = await createAuthenticatedCaller(profileAdmin.email);

    const [bySlug, byInstance] = await Promise.all([
      caller.decision.getDecisionBySlug({ slug: setup.instance.slug }),
      caller.decision.getInstance({
        instanceId: setup.instance.instance.id,
      }),
    ]);

    expect(bySlug.processInstance.access).toEqual(byInstance.access);
    expect(bySlug.processInstance.access?.admin).toBe(true);
  });
});
