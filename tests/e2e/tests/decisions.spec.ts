import { db } from '@op/db';
import {
  EntityType,
  ProcessStatus,
  decisionProcesses,
  processInstances,
  profileUserToAccessRoles,
  profileUsers,
  profiles,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { expect, test } from '../fixtures/index.js';

/**
 * A simple test schema in the DecisionSchemaDefinition format.
 * Mirrors the testDecisionSchema from TestDecisionsDataManager.
 */
const testDecisionSchema = {
  id: 'test-schema',
  version: '1.0.0',
  name: 'Test Schema',
  description: 'A simple schema for testing',
  phases: [
    {
      id: 'initial',
      name: 'Initial Phase',
      description: 'The starting phase',
      rules: {
        proposals: { submit: true },
        voting: { submit: false },
        advancement: { method: 'manual' },
      },
    },
    {
      id: 'final',
      name: 'Final Phase',
      description: 'The ending phase',
      rules: {
        proposals: { submit: false },
        voting: { submit: false },
        advancement: { method: 'manual' },
      },
    },
  ],
};

/**
 * Helper to create a decision instance with proper profile access.
 * Mirrors TestDecisionsDataManager.createInstanceForProcess but adapted for Playwright.
 */
async function createDecisionInstance({
  processId,
  ownerProfileId,
  authUserId,
  email,
}: {
  processId: string;
  ownerProfileId: string;
  authUserId: string;
  email: string;
}) {
  const instanceName = `E2E Instance ${randomUUID()}`;
  const instanceSlug = `e2e-instance-${randomUUID()}`;

  // 1. Create a profile for the process instance with DECISION type
  const [instanceProfile] = await db
    .insert(profiles)
    .values({
      name: instanceName,
      slug: instanceSlug,
      type: EntityType.DECISION,
    })
    .returning();

  if (!instanceProfile) {
    throw new Error('Failed to create instance profile');
  }

  // 2. Create the process instance with proper instanceData structure
  // This must match DecisionInstanceData from schemas/instanceData.ts
  const instanceData = {
    currentPhaseId: 'initial',
    phases: testDecisionSchema.phases.map((phase, index) => ({
      phaseId: phase.id,
      rules: phase.rules,
      startDate: new Date(
        Date.now() + index * 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      endDate: new Date(
        Date.now() + (index + 1) * 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    })),
  };

  const [processInstance] = await db
    .insert(processInstances)
    .values({
      name: instanceName,
      processId,
      profileId: instanceProfile.id,
      instanceData,
      currentStateId: 'initial',
      status: ProcessStatus.PUBLISHED,
      ownerProfileId,
    })
    .returning();

  if (!processInstance) {
    throw new Error('Failed to create process instance');
  }

  // 3. Grant the user access to the decision profile (Admin role)
  const [profileUser] = await db
    .insert(profileUsers)
    .values({
      profileId: instanceProfile.id,
      authUserId,
      email,
    })
    .returning();

  if (profileUser) {
    await db.insert(profileUserToAccessRoles).values({
      profileUserId: profileUser.id,
      accessRoleId: ROLES.ADMIN.id,
    });
  }

  return {
    instance: processInstance,
    profileId: instanceProfile.id,
    slug: instanceSlug,
    name: instanceName,
  };
}

test.describe('Decisions', () => {
  test('can navigate to a decision process page', async ({
    authenticatedPage,
    org,
  }) => {
    // Track IDs for cleanup
    const createdProfileIds: string[] = [];
    let processId: string | undefined;

    try {
      // 1. Create a decision process template
      const processName = `E2E Test Process ${randomUUID()}`;
      const [processRecord] = await db
        .insert(decisionProcesses)
        .values({
          name: processName,
          description: 'E2E test decision process',
          processSchema: testDecisionSchema,
          createdByProfileId: org.adminUser.profileId,
        })
        .returning();

      if (!processRecord) {
        throw new Error('Failed to create decision process');
      }
      processId = processRecord.id;

      // 2. Create a decision instance with access for the authenticated user
      const instance = await createDecisionInstance({
        processId,
        ownerProfileId: org.organizationProfile.id,
        authUserId: org.adminUser.authUserId,
        email: org.adminUser.email,
      });
      createdProfileIds.push(instance.profileId);

      // 3. Give the database a moment to ensure the transaction is committed
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 4. Navigate to the decision page with networkidle to ensure full load
      await authenticatedPage.goto(`/en/decisions/${instance.slug}`, {
        waitUntil: 'networkidle',
      });

      // 5. Verify we're on the decision page and not redirected elsewhere
      await expect(authenticatedPage).toHaveURL(
        new RegExp(`/decisions/${instance.slug}`),
      );

      // 6. Check for error states - if we see a 500 error, retry the navigation
      const has500Error = await authenticatedPage
        .getByRole('heading', { name: '500' })
        .isVisible()
        .catch(() => false);

      if (has500Error) {
        // Server may have a stale cache - reload the page
        await authenticatedPage.reload({ waitUntil: 'networkidle' });
      }

      // 7. Verify we don't see "Not Found" page
      const notFoundText = authenticatedPage.getByText(
        'This page could not be found',
      );
      await expect(notFoundText).not.toBeVisible({ timeout: 5000 });

      // 8. Wait for the page to load and verify content
      // The DecisionHeader displays the process name (instance.process?.name || instance.name)
      await expect(
        authenticatedPage.getByRole('heading', { name: processName }),
      ).toBeVisible({ timeout: 15000 });
    } finally {
      // Cleanup: delete created resources in reverse order
      // Profile deletion cascades to process instances and profile users
      if (createdProfileIds.length > 0) {
        await db
          .delete(profiles)
          .where(inArray(profiles.id, createdProfileIds));
      }
      if (processId) {
        await db
          .delete(decisionProcesses)
          .where(eq(decisionProcesses.id, processId));
      }
    }
  });
});
