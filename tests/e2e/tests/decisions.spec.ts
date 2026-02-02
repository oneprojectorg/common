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
 * A simple voting schema for E2E tests.
 * This mirrors the simpleVoting schema from @op/common but is self-contained
 * to avoid ESM/CJS import issues in the E2E test environment.
 */
const testSimpleVotingSchema = {
  id: 'simple',
  version: '1.0.0',
  name: 'Simple Voting',
  description:
    'Basic approval voting where members vote for multiple proposals.',
  phases: [
    {
      id: 'submission',
      name: 'Proposal Submission',
      description: 'Members submit proposals for consideration.',
      rules: {
        proposals: { submit: true },
        voting: { submit: false },
        advancement: { method: 'date', endDate: '2026-01-01' },
      },
    },
    {
      id: 'review',
      name: 'Review & Shortlist',
      description: 'Reviewers evaluate and shortlist proposals.',
      rules: {
        proposals: { submit: false },
        voting: { submit: false },
        advancement: { method: 'date', endDate: '2026-01-02' },
      },
    },
    {
      id: 'voting',
      name: 'Voting',
      description: 'Members vote on shortlisted proposals.',
      rules: {
        proposals: { submit: false },
        voting: { submit: true },
        advancement: { method: 'date', endDate: '2026-01-03' },
      },
    },
    {
      id: 'results',
      name: 'Results',
      description: 'View final results and winning proposals.',
      rules: {
        proposals: { submit: false },
        voting: { submit: false },
        advancement: { method: 'date', endDate: '2026-01-04' },
      },
    },
  ],
};

/**
 * Helper to create a decision process template for testing.
 */
async function createDecisionProcess(createdByProfileId: string) {
  const processName = `E2E Simple Voting ${randomUUID().slice(0, 8)}`;

  const [processRecord] = await db
    .insert(decisionProcesses)
    .values({
      name: processName,
      description: testSimpleVotingSchema.description,
      processSchema: testSimpleVotingSchema,
      createdByProfileId,
    })
    .returning();

  if (!processRecord) {
    throw new Error('Failed to create decision process');
  }

  return processRecord;
}

/**
 * Helper to create a decision instance with proper profile access.
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
  const firstPhaseId = testSimpleVotingSchema.phases[0]?.id ?? 'submission';

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
  const instanceData = {
    currentPhaseId: firstPhaseId,
    phases: testSimpleVotingSchema.phases.map((phase, index) => ({
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
      currentStateId: firstPhaseId,
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
      const process = await createDecisionProcess(org.adminUser.profileId);
      processId = process.id;

      // 2. Create a decision instance with access for the authenticated user
      const instance = await createDecisionInstance({
        processId: process.id,
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

      // 6. Wait for the page to load and verify content
      // The DecisionHeader displays the process name
      await expect(
        authenticatedPage.getByRole('heading', { name: process.name }),
      ).toBeVisible({ timeout: 15000 });
    } finally {
      // Cleanup: delete created resources in reverse order
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

  test('can submit a proposal from decision page', async ({
    authenticatedPage,
    org,
  }) => {
    // Track IDs for cleanup
    const createdProfileIds: string[] = [];
    let processId: string | undefined;

    try {
      // 1. Create a decision process template
      const process = await createDecisionProcess(org.adminUser.profileId);
      processId = process.id;

      // 2. Create a decision instance with access for the authenticated user
      const instance = await createDecisionInstance({
        processId: process.id,
        ownerProfileId: org.organizationProfile.id,
        authUserId: org.adminUser.authUserId,
        email: org.adminUser.email,
      });
      createdProfileIds.push(instance.profileId);

      // 3. Give the database a moment to ensure the transaction is committed
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 4. Navigate to the decision page
      await authenticatedPage.goto(`/en/decisions/${instance.slug}`, {
        waitUntil: 'networkidle',
      });

      // 5. Wait for the page to load
      await expect(
        authenticatedPage.getByRole('heading', { name: process.name }),
      ).toBeVisible({ timeout: 15000 });

      // 6. Click the "Submit a proposal" button
      const submitButton = authenticatedPage.getByRole('button', {
        name: 'Submit a proposal',
      });
      await expect(submitButton).toBeVisible({ timeout: 5000 });
      await submitButton.click();

      // 7. Wait for navigation to the proposal edit page
      // The URL pattern is /decisions/{slug}/proposal/{profileId}/edit
      await expect(authenticatedPage).toHaveURL(
        new RegExp(`/decisions/${instance.slug}/proposal/[^/]+/edit`),
        { timeout: 15000 },
      );

      // 8. Verify we're on the proposal editor page
      // The ProposalEditor shows "Untitled Proposal" heading and has a "Submit Proposal" button
      await expect(
        authenticatedPage.getByText('Untitled Proposal'),
      ).toBeVisible({ timeout: 10000 });

      await expect(
        authenticatedPage.getByRole('button', { name: 'Submit Proposal' }),
      ).toBeVisible({ timeout: 5000 });
    } finally {
      // Cleanup: delete created resources in reverse order
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
