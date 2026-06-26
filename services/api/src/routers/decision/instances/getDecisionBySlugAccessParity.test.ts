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
 * (router derives it via getProfileAccessRoles -> decisions bitfield) instead of
 * getInstance (resolveInstanceAccess, which adds a profile-admin ALL_TRUE bypass
 * + org fallback). Safe only if the two derivations agree for the capabilities
 * the overview gates on (admin, submitProposals).
 *
 * SCOPE (be honest about what this proves): this pins parity for the DEFAULT
 * Admin role only. That role grants `profile.admin` AND the full decisions
 * bitfield, so BOTH paths return admin=true — getInstance via the profile-admin
 * bypass, getDecisionBySlug via the bitfield. They agree, but for different
 * reasons, so this case does NOT exercise the bypass itself.
 *
 * KNOWN LIMITATIONS this test does NOT cover (see PR #1417 review):
 *  - A custom role granting `profile.admin` WITHOUT decisions-admin/submit bits:
 *    getInstance would return admin=true (bypass), getDecisionBySlug admin=false
 *    (bitfield) → /overview would under-report CTAs. Reachable via custom roles
 *    (createDecisionRole); unverified whether such roles exist in production.
 *  - Org-only viewers (org role, no profile grant): NOT relevant to /overview —
 *    its gate (assertProfileAccess, profile-only) already 403s them before render.
 *  If custom profile-admin roles are in use, fix the router to derive access like
 *  getInstance (getProfileAccessRolesWithOrgFallback + profile-admin bypass).
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
