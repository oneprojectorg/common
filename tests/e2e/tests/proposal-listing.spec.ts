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
import { db } from '@op/db/test';
import { createProposal } from '@op/test';
import { randomUUID } from 'node:crypto';

import { transformFormDataToProcessSchema as cowopSchema } from '../../../apps/app/src/components/Profile/CreateDecisionProcessModal/schemas/cowop';
import { expect, test } from '../fixtures/index.js';

/**
 * The collab mock (@op/collab/testing) pre-seeds this doc ID with fixture
 * content (bold/italic text, list items, links, etc.). Any other ID 404s.
 */
const MOCK_DOC_ID = 'test-proposal-doc';

/**
 * Helper to create a decision process, instance, profile, and admin access
 * in one shot. Returns everything needed to create proposals and navigate.
 */
async function createProcessAndInstance({
  org,
  processSchema,
  instanceData,
  processName,
}: {
  org: {
    organizationProfile: { id: string };
    adminUser: { authUserId: string; email: string };
  };
  processSchema: Record<string, unknown>;
  instanceData: Record<string, unknown>;
  processName: string;
}) {
  const [process] = await db
    .insert(decisionProcesses)
    .values({
      name: processName,
      description: `${processName} for e2e listing test`,
      processSchema,
      createdByProfileId: org.organizationProfile.id,
    })
    .returning();

  if (!process) {
    throw new Error(`Failed to create process: ${processName}`);
  }

  const slug = `test-listing-${randomUUID()}`;
  const name = `${processName} ${randomUUID().slice(0, 8)}`;

  const [profile] = await db
    .insert(profiles)
    .values({ name, slug, type: EntityType.DECISION })
    .returning();

  if (!profile) {
    throw new Error('Failed to create instance profile');
  }

  const [instance] = await db
    .insert(processInstances)
    .values({
      name,
      processId: process.id,
      profileId: profile.id,
      instanceData,
      currentStateId:
        (instanceData as { currentPhaseId?: string }).currentPhaseId ??
        'proposalSubmission',
      status: ProcessStatus.PUBLISHED,
      ownerProfileId: org.organizationProfile.id,
    })
    .returning();

  if (!instance) {
    throw new Error('Failed to create process instance');
  }

  const [profileUser] = await db
    .insert(profileUsers)
    .values({
      profileId: profile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
    })
    .returning();

  if (profileUser) {
    await db.insert(profileUserToAccessRoles).values({
      profileUserId: profileUser.id,
      accessRoleId: ROLES.ADMIN.id,
    });
  }

  return { process, instance, profile, slug, name };
}

test.describe('Proposal Listing', () => {
  /**
   * New-schema process: proposalTemplate lives in instanceData (the standard
   * path for recently-created decision instances). Budget uses the new
   * `{ amount, currency }` object format with `x-format: 'money'`.
   */
  test('lists proposals for a new-schema decision instance', async ({
    authenticatedPage,
    org,
  }) => {
    // 1. Create a new-schema process with proposalTemplate using x-format: 'money'
    const newProcessSchema = {
      id: 'new-schema-listing',
      version: '1.0.0',
      name: 'New Schema Listing Test',
      description: 'Modern process with budget as money object',
      phases: [
        {
          id: 'proposalSubmission',
          name: 'Proposal Submission',
          description: 'Submit proposals',
          rules: {
            proposals: { submit: true },
            voting: { submit: false },
            advancement: { method: 'manual' as const },
          },
        },
        {
          id: 'review',
          name: 'Review',
          description: 'Review proposals',
          rules: {
            proposals: { submit: false },
            voting: { submit: false },
            advancement: { method: 'manual' as const },
          },
        },
      ],
      proposalTemplate: {
        type: 'object',
        required: ['title'],
        'x-field-order': ['title', 'summary', 'budget'],
        properties: {
          title: { type: 'string' },
          summary: { type: 'string', 'x-format': 'richtext' },
          budget: {
            type: 'object',
            'x-format': 'money',
            properties: {
              amount: { type: 'number' },
              currency: { type: 'string' },
            },
          },
        },
      },
    };

    // instanceData includes the proposalTemplate (new-schema path)
    const newInstanceData = {
      currentPhaseId: 'proposalSubmission',
      budget: 50000,
      hideBudget: false,
      proposalTemplate: newProcessSchema.proposalTemplate,
      phases: [
        {
          phaseId: 'proposalSubmission',
          startDate: '2025-09-20',
          endDate: '2025-10-01',
        },
        {
          phaseId: 'review',
          startDate: '2025-10-02',
          endDate: '2025-10-20',
        },
      ],
    };

    const { instance, slug, name } = await createProcessAndInstance({
      org,
      processSchema: newProcessSchema,
      instanceData: newInstanceData,
      processName: 'New Schema Listing',
    });

    // 2. Create two proposals with new-format budgets and collaborationDocId
    await createProposal({
      processInstanceId: instance.id,
      submittedByProfileId: org.organizationProfile.id,
      proposalData: {
        title: 'Community Garden Project',
        collaborationDocId: MOCK_DOC_ID,
        budget: { amount: 8000, currency: 'USD' },
      },
    });

    await createProposal({
      processInstanceId: instance.id,
      submittedByProfileId: org.organizationProfile.id,
      proposalData: {
        title: 'Youth Mentorship Program',
        collaborationDocId: MOCK_DOC_ID,
        budget: { amount: 12500, currency: 'EUR' },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    // 3. Navigate with ?filter=all (default is "Shortlisted" which hides drafts)
    await authenticatedPage.goto(`/en/decisions/${slug}?filter=all`, {
      waitUntil: 'networkidle',
    });

    // Decision heading renders
    await expect(authenticatedPage.getByRole('heading', { name })).toBeVisible({
      timeout: 30_000,
    });

    // Both proposal titles appear as links in the listing
    await expect(
      authenticatedPage.getByRole('link', { name: 'Community Garden Project' }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      authenticatedPage.getByRole('link', {
        name: 'Youth Mentorship Program',
      }),
    ).toBeVisible();

    // Budget values rendered with correct formatting
    await expect(authenticatedPage.getByText('$8,000')).toBeVisible();
    await expect(authenticatedPage.getByText('€12,500')).toBeVisible();

    // Card preview renders text from the collab mock fixture.
    // The mock returns TipTap JSON with "Bold text and italic text..." content.
    await expect(
      authenticatedPage.getByText('Bold text').first(),
    ).toBeVisible();
  });

  /**
   * Legacy COWOP process: proposalTemplate lives in
   * `decision_processes.process_schema` (NOT in instanceData). Budget is stored
   * as a plain number and must be normalised to { amount, currency: 'USD' }.
   *
   * This mirrors real production COWOP data where older processes never had
   * proposalTemplate at the instance level.
   *
   * @see https://github.com/oneprojectorg/common/pull/601#discussion_r2803602140
   */
  test('lists proposals for a legacy cowop process with budget from process_schema', async ({
    authenticatedPage,
    org,
  }) => {
    // 1. Build a COWOP process schema from the actual legacy cowop schema fn.
    //    Budget is { type: 'number' }, no x-field-order, no x-format.
    const cowopLegacySchema = cowopSchema({
      processName: 'COWOP Listing Test',
      totalBudget: 100000,
      budgetCapAmount: 100000,
      requireBudget: true,
      categories: [
        'Ai. Direct funding to worker-owned co-ops.',
        'Bv. Support regional co-op organizing groups.',
        'other',
      ],
    });

    // Wrap in a DecisionSchemaDefinition envelope so the
    // decisionSchemaDefinitionEncoder doesn't reject it.
    const cowopProcessSchema = {
      id: 'cowop-listing-test',
      version: '1.0.0',
      name: cowopLegacySchema.name,
      description: cowopLegacySchema.description,
      phases: [
        {
          id: 'ideaCollection',
          name: 'Proposal Concept Generation',
          description: 'Submit proposal concepts',
          rules: {
            proposals: { submit: true },
            voting: { submit: false },
            advancement: { method: 'manual' as const },
          },
        },
        {
          id: 'submission',
          name: 'Proposal Development',
          description: 'Develop proposals',
          rules: {
            proposals: { submit: false },
            voting: { submit: false },
            advancement: { method: 'manual' as const },
          },
        },
      ],
      proposalTemplate: cowopLegacySchema.proposalTemplate,
    };

    // COWOP-style instanceData — no proposalTemplate, has fieldValues
    const cowopInstanceData = {
      currentPhaseId: 'ideaCollection',
      budget: 100000,
      hideBudget: false,
      phases: [
        {
          phaseId: 'ideaCollection',
          startDate: '2025-09-20',
          endDate: '2025-10-01',
        },
        {
          phaseId: 'submission',
          startDate: '2025-10-02',
          endDate: '2025-10-20',
        },
      ],
      fieldValues: {
        categories: [
          'Ai. Direct funding to worker-owned co-ops.',
          'Bv. Support regional co-op organizing groups.',
          'other',
        ],
        budgetCapAmount: 100000,
      },
    };

    const { instance, slug, name } = await createProcessAndInstance({
      org,
      processSchema: cowopProcessSchema,
      instanceData: cowopInstanceData,
      processName: 'COWOP Listing',
    });

    // 2. Create two proposals with legacy plain-number budgets
    await createProposal({
      processInstanceId: instance.id,
      submittedByProfileId: org.organizationProfile.id,
      proposalData: {
        title: 'Worker Co-op Equipment Fund',
        description:
          '<p>Requesting funds for <strong>equipment upgrades</strong>.</p>',
        budget: 15000,
        category: 'Ai. Direct funding to worker-owned co-ops.',
      },
    });

    await createProposal({
      processInstanceId: instance.id,
      submittedByProfileId: org.organizationProfile.id,
      proposalData: {
        title: 'Regional Organizer Training',
        description:
          '<p>Training program for <strong>regional co-op organizers</strong>.</p>',
        budget: 25000,
        category: 'Bv. Support regional co-op organizing groups.',
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    // 3. Navigate with ?filter=all (default is "Shortlisted" which hides drafts)
    await authenticatedPage.goto(`/en/decisions/${slug}?filter=all`, {
      waitUntil: 'networkidle',
    });

    // Decision heading renders
    await expect(authenticatedPage.getByRole('heading', { name })).toBeVisible({
      timeout: 30_000,
    });

    // Both proposal titles appear as links
    await expect(
      authenticatedPage.getByRole('link', {
        name: 'Worker Co-op Equipment Fund',
      }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      authenticatedPage.getByRole('link', {
        name: 'Regional Organizer Training',
      }),
    ).toBeVisible();

    // Legacy plain-number budgets (15000, 25000) normalised to USD and
    // rendered as "$15,000" and "$25,000"
    await expect(authenticatedPage.getByText('$15,000')).toBeVisible();
    await expect(authenticatedPage.getByText('$25,000')).toBeVisible();

    // Legacy HTML descriptions render as text preview in the card
    await expect(
      authenticatedPage.getByText('Requesting funds for equipment upgrades.'),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByText(
        'Training program for regional co-op organizers.',
      ),
    ).toBeVisible();
  });
});
