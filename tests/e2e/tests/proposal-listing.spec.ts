import {
  EntityType,
  ProcessStatus,
  ProposalStatus,
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
import { transformFormDataToProcessSchema as horizonSchema } from '../../../apps/app/src/components/Profile/CreateDecisionProcessModal/schemas/horizon';
import { expect, test } from '../fixtures/index.js';

/**
 * The collab mock (@op/collab/testing) pre-seeds this doc ID with fixture
 * content (bold/italic text, list items, links, etc.). Any other ID 404s.
 */
const MOCK_DOC_ID = 'test-proposal-listing-doc';
const ALT_MOCK_DOC_ID = 'test-proposal-listing-doc-alt';

/**
 * Helper to create a decision process, instance, profile, and admin access
 * in one shot. Returns everything needed to create proposals and navigate.
 */
async function createProcessAndInstance({
  org,
  processSchema,
  instanceData,
  processName,
  currentStateId,
}: {
  org: {
    organizationProfile: { id: string };
    adminUser: { authUserId: string; email: string };
  };
  processSchema: Record<string, unknown>;
  instanceData: Record<string, unknown>;
  processName: string;
  /**
   * Row-level current state. Defaults to the first phase; legacy instances must
   * pass it explicitly because their phases are keyed by `stateId`.
   */
  currentStateId?: string;
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
        currentStateId ??
        (instanceData as { phases?: { phaseId: string }[] }).phases?.[0]
          ?.phaseId ??
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
        'x-field-order': ['title', 'summary', 'budget', 'category'],
        properties: {
          title: {
            type: 'string',
            title: 'Title',
            'x-format': 'short-text',
          },
          summary: {
            type: 'string',
            title: 'Summary',
            'x-format': 'long-text',
          },
          budget: {
            type: 'object',
            title: 'Budget',
            'x-format': 'money',
            properties: {
              amount: { type: 'number' },
              currency: { type: 'string' },
            },
          },
          category: {
            type: ['string', 'null'],
            title: 'Category',
            'x-format': 'dropdown',
            oneOf: [
              { const: 'Environment', title: 'Environment' },
              { const: 'Education', title: 'Education' },
              { const: 'Infrastructure', title: 'Infrastructure' },
            ],
          },
        },
      },
    };

    // instanceData includes the proposalTemplate (new-schema path)
    const newInstanceData = {
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

    // 2. Create two proposals with new-format budgets, categories, and summary collab content
    await createProposal({
      processInstanceId: instance.id,
      submittedByProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      proposalData: {
        title: 'Community Garden Project',
        collaborationDocId: MOCK_DOC_ID,
        budget: { amount: 8000, currency: 'USD' },
        category: 'Environment',
      },
    });

    await createProposal({
      processInstanceId: instance.id,
      submittedByProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      proposalData: {
        title: 'Youth Mentorship Program',
        collaborationDocId: ALT_MOCK_DOC_ID,
        budget: { amount: 12500, currency: 'EUR' },
        category: 'Education',
      },
    });

    // 3. Navigate with ?filter=all (default is ALL which shows drafts)
    await authenticatedPage.goto(`/en/decisions/${slug}/current?filter=all`, {
      waitUntil: 'domcontentloaded',
    });

    // Decision heading renders
    await expect(
      authenticatedPage.getByRole('heading', { name, level: 2 }),
    ).toBeVisible({
      timeout: 30_000,
    });

    // Both proposal titles appear as links in the listing
    await expect(
      authenticatedPage.getByRole('link', {
        name: 'Community Garden Project',
      }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      authenticatedPage.getByRole('link', {
        name: 'Youth Mentorship Program',
      }),
    ).toBeVisible();

    // Budget values rendered with correct formatting
    await expect(authenticatedPage.getByText('$8,000')).toBeVisible();
    await expect(authenticatedPage.getByText('€12,500')).toBeVisible();

    // Category values rendered in Chip components on the proposal cards
    await expect(authenticatedPage.getByText('Environment')).toBeVisible();
    await expect(authenticatedPage.getByText('Education')).toBeVisible();

    // Card preview renders text from the collab summary fragment.
    await expect(
      authenticatedPage.getByText('Bold text').first(),
    ).toBeVisible();

    await expect(
      authenticatedPage.getByText('Content could not be loaded'),
    ).not.toBeVisible();
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
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
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
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      proposalData: {
        title: 'Regional Organizer Training',
        description:
          '<p>Training program for <strong>regional co-op organizers</strong>.</p>',
        budget: 25000,
        category: 'Bv. Support regional co-op organizing groups.',
      },
    });

    // 3. Navigate with ?filter=all (default is ALL which shows drafts)
    await authenticatedPage.goto(`/en/decisions/${slug}/current?filter=all`, {
      waitUntil: 'domcontentloaded',
    });

    // Decision heading renders
    await expect(
      authenticatedPage.getByRole('heading', { name, level: 2 }),
    ).toBeVisible({
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

    // Category values rendered in Chip components on the proposal cards
    await expect(
      authenticatedPage.getByText('Ai. Direct funding to worker-owned co-ops.'),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByText(
        'Bv. Support regional co-op organizing groups.',
      ),
    ).toBeVisible();

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

  /**
   * Legacy Horizon Fund–shaped process on the legacy results route: the process
   * schema is state-based (`states`/`transitions`/`initialState`) and
   * `instanceData.phases[]` are keyed by `stateId`, so `decision.getInstance`
   * rejects the instance in output validation — its v2 encoder requires
   * `processSchema.{id,version,phases}` and `phases[].phaseId`. Nothing on this
   * screen may call that endpoint, or the whole page 500s.
   *
   * Regression guard for the Horizon Fund "All proposals" 500.
   */
  test('lists all proposals on the legacy results route for a state-based instance', async ({
    authenticatedPage,
    org,
  }) => {
    // Real legacy schema: 4 states (submission → review → voting → results),
    // no `id`/`version`/`phases` envelope.
    const horizonLegacySchema = horizonSchema({
      processName: 'Horizon Legacy Results Test',
      description: 'Legacy state-based process',
      totalBudget: 100000,
      budgetCapAmount: 50000,
      requireBudget: true,
      categories: ['Energy democracy', 'Housing justice'],
    });

    // Legacy instanceData: `stateId`/`plannedStartDate` field names and
    // `currentStateId` inside the JSON blob — what production rows hold.
    const legacyInstanceData = {
      budget: 100000,
      hideBudget: false,
      currentStateId: 'results',
      phases: [
        {
          stateId: 'submission',
          plannedStartDate: '2025-09-01',
          plannedEndDate: '2025-09-30',
        },
        {
          stateId: 'review',
          plannedStartDate: '2025-10-01',
          plannedEndDate: '2025-10-15',
        },
        {
          stateId: 'voting',
          plannedStartDate: '2025-10-16',
          plannedEndDate: '2025-10-31',
        },
        { stateId: 'results', plannedStartDate: '2025-11-01' },
      ],
    };

    const { instance } = await createProcessAndInstance({
      org,
      processSchema: horizonLegacySchema,
      instanceData: legacyInstanceData,
      processName: 'Horizon Legacy Results',
      currentStateId: 'results',
    });

    // Submitted, not draft — the results list excludes drafts.
    await createProposal({
      processInstanceId: instance.id,
      submittedByProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      status: ProposalStatus.SUBMITTED,
      proposalData: {
        title: 'Community Solar Array',
        description: '<p>Rooftop solar for the co-op block.</p>',
        budget: 15000,
      },
    });

    await createProposal({
      processInstanceId: instance.id,
      submittedByProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      status: ProposalStatus.SUBMITTED,
      proposalData: {
        title: 'Tenant Union Support Fund',
        description: '<p>Organizing support for tenant unions.</p>',
        budget: 25000,
      },
    });

    // The legacy route — /profile/[slug]/decisions/[id] — always renders the
    // results screen, whose default tab is "Selected Proposals".
    await authenticatedPage.goto(
      `/en/profile/${org.organizationProfile.slug}/decisions/${instance.id}`,
      { waitUntil: 'domcontentloaded' },
    );

    await authenticatedPage
      .getByRole('tab', { name: 'All proposals' })
      .click({ timeout: 30_000 });

    await expect(
      authenticatedPage.getByRole('link', { name: 'Community Solar Array' }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      authenticatedPage.getByRole('link', {
        name: 'Tenant Union Support Fund',
      }),
    ).toBeVisible();

    // The 500 screen this route used to render instead of the list.
    await expect(
      authenticatedPage.getByText(
        "Something went wrong on our end. We're working to fix it.",
      ),
    ).not.toBeVisible();
  });
});
