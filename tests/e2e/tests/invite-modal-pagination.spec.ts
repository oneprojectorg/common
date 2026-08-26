import { profiles, users } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import {
  createDecisionInstance,
  getSeededTemplate,
  grantInstanceReviewerRole,
} from '@op/test';
import { randomUUID } from 'node:crypto';

import {
  createSupabaseAdminClient,
  createUser,
  expect,
  test,
} from '../fixtures/index.js';

// ProfileInviteModal requests pages of 100 (services/api's max limit). One
// more than that forces a second page, reproducing the reported bug where
// the invite modal only read the first page.
const REVIEWER_COUNT = 101;

// Local Supabase Auth (bcrypt) and the DB pool (DB_POOL_MAX defaults to 10)
// can't take REVIEWER_COUNT fully-concurrent requests; run in small batches.
const BATCH_SIZE = 10;

async function inBatches<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    results.push(...(await Promise.all(batch.map(fn))));
  }
  return results;
}

test.describe('Invite modal participant pagination', () => {
  test('reviewer tab count includes members past the first page', async ({
    authenticatedPage,
    org,
  }) => {
    // Seeding 101 real Supabase users well exceeds the suite's 60s default.
    test.setTimeout(120_000);

    const supabaseAdmin = createSupabaseAdminClient();
    const template = await getSeededTemplate();
    const testId = randomUUID().slice(0, 6);

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
    });

    const reviewers = await inBatches(
      Array.from({ length: REVIEWER_COUNT }, (_, index) => index),
      (index) =>
        createUser({
          supabaseAdmin,
          email: `e2e-${testId}-reviewer-${String(index).padStart(3, '0')}@oneproject.org`,
        }),
    );

    try {
      const reviewerRoleName = `Reviewer-${testId}`;
      const [first, ...rest] = reviewers;
      if (!first) {
        throw new Error('Expected at least one reviewer');
      }
      const { roleId: accessRoleId } = await grantInstanceReviewerRole({
        instanceProfileId: instance.profileId,
        authUserId: first.id,
        email: first.email,
        roleName: reviewerRoleName,
      });
      await inBatches(rest, (reviewer) =>
        grantInstanceReviewerRole({
          instanceProfileId: instance.profileId,
          authUserId: reviewer.id,
          email: reviewer.email,
          roleName: reviewerRoleName,
          accessRoleId,
        }),
      );

      await authenticatedPage.goto(`/en/decisions/${instance.slug}/edit`);
      await authenticatedPage
        .getByRole('button', { name: 'Manage Participants' })
        .click();
      await authenticatedPage.getByRole('button', { name: 'Invite' }).click();

      // Anchored at both ends: the role name embeds a random hex testId, and
      // an unanchored match on REVIEWER_COUNT could accidentally hit a
      // substring of that id instead of the actual count badge. The
      // accessible name inserts a space between the role label and the badge
      // that isn't present in the rendered text content.
      const reviewerTab = authenticatedPage.getByRole('tab', {
        name: new RegExp(`^${reviewerRoleName}s\\s*${REVIEWER_COUNT}$`),
      });
      await expect(reviewerTab).toBeVisible({ timeout: 20_000 });
    } finally {
      // 101 auth users (each with an auto-created personal profile) is far
      // more than other specs leave behind; clean up so they don't pollute
      // profile.search results for the rest of the suite.
      await inBatches(reviewers, async (reviewer) => {
        const [userRecord] = await db
          .select()
          .from(users)
          .where(eq(users.authUserId, reviewer.id));
        if (userRecord?.profileId) {
          await db
            .delete(profiles)
            .where(eq(profiles.id, userRecord.profileId));
        }
        await supabaseAdmin.auth.admin.deleteUser(reviewer.id);
      });
    }
  });
});
