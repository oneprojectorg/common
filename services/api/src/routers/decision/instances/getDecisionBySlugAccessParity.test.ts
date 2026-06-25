import { describe, expect, it } from 'vitest';

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

/**
 * /overview is single-fetch: it reads per-user `access` from getDecisionBySlug
 * (which the router derives via getProfileAccessRoles -> decisions bitfield)
 * instead of getInstance (resolveInstanceAccess, which adds a profile-admin
 * ALL_TRUE bypass + org fallback). This is only safe if the two derivations
 * agree for the capabilities the overview gates on (admin, submitProposals).
 *
 * They agree for the default decision roles because the Admin role grants the
 * decisions bits explicitly (decisionRoles.ts) — so the bitfield path already
 * reflects admin, making the bypass redundant. These tests pin that parity; if
 * a future role change reintroduces a profile-admin-without-decisions-bits
 * grant, the overview CTAs would diverge and this fails.
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
});
