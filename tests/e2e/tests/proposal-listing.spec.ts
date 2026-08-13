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
        (instanceData as { phases?: { phaseId: string }[] }).phases?.[0]
          ?.phaseId ?? 'proposalSubmission',
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

  /** A two-proposal instance in a proposal-submission phase, for search tests. */
  async function createSearchListing(org: {
    organizationProfile: { id: string };
    adminUser: { authUserId: string; email: string };
  }) {
    const searchProcessSchema = {
      id: 'search-listing',
      version: '1.0.0',
      name: 'Search Listing Test',
      description: 'Process for exercising proposal search',
      // Two phases: a single-phase instance is its own last phase, and
      // instanceData carries no `rules`, so the router lands on the results view.
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
        'x-field-order': ['title'],
        properties: {
          title: { type: 'string', title: 'Title', 'x-format': 'short-text' },
        },
      },
    };

    const { instance, slug, name } = await createProcessAndInstance({
      org,
      processSchema: searchProcessSchema,
      instanceData: {
        proposalTemplate: searchProcessSchema.proposalTemplate,
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
      },
      processName: 'Search Listing',
    });

    for (const title of ['Riverside Bike Path', 'Downtown Mural']) {
      await createProposal({
        processInstanceId: instance.id,
        submittedByProfileId: org.organizationProfile.id,
        authUserId: org.adminUser.authUserId,
        email: org.adminUser.email,
        // Not a collab doc: the mock docs' own title fragment overrides the card title.
        proposalData: { title, description: `<p>${title} details.</p>` },
      });
    }

    return { slug, name };
  }

  /**
   * Search filters behind a suspense query. The field must keep focus across the
   * refetch — a remounted subtree would blur it, capping input at one word.
   */
  test('filters the grid by title search without dropping input focus', async ({
    authenticatedPage,
    org,
  }) => {
    const { slug, name } = await createSearchListing(org);

    await authenticatedPage.goto(`/en/decisions/${slug}/current?filter=all`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(
      authenticatedPage.getByRole('heading', { name, level: 2 }),
    ).toBeVisible({ timeout: 30_000 });

    const bikePath = authenticatedPage.getByRole('link', {
      name: 'Riverside Bike Path',
    });
    const mural = authenticatedPage.getByRole('link', {
      name: 'Downtown Mural',
    });

    await expect(bikePath).toBeVisible({ timeout: 15_000 });
    await expect(mural).toBeVisible();

    const searchField = authenticatedPage.getByRole('searchbox', {
      name: 'Search proposals',
    });

    // Nine characters inside the debounce window must produce one fetch, not nine.
    let listRequestCount = 0;
    const countListRequests = (request: { url: () => string }) => {
      if (request.url().includes('listProposals')) {
        listRequestCount += 1;
      }
    };
    authenticatedPage.on('request', countListRequests);

    await searchField.click();
    // 9 chars at 20ms lands inside the 300ms debounce.
    await searchField.pressSequentially('bike path', { delay: 20 });

    await expect(mural).toBeHidden({ timeout: 15_000 });
    await expect(bikePath).toBeVisible();

    authenticatedPage.off('request', countListRequests);
    // Batching can fold the list read and the count query together, so allow two.
    expect(listRequestCount).toBeGreaterThan(0);
    expect(listRequestCount).toBeLessThanOrEqual(2);

    // Inline at md:w-52 (208px group) rather than spanning the row — the mobile
    // test asserts the full-width counterpart.
    const desktopBox = await searchField.boundingBox();
    expect(desktopBox?.width).toBeLessThan(230);

    // Still focused, so the bar was never swapped for the loading skeleton.
    await expect(searchField).toBeFocused();
    await expect(searchField).toHaveValue('bike path');
    expect(new URL(authenticatedPage.url()).searchParams.get('q')).toBe(
      'bike path',
    );

    // Clearing restores the full set.
    await authenticatedPage
      .getByRole('button', { name: 'Clear search' })
      .click();
    await expect(mural).toBeVisible({ timeout: 15_000 });
    await expect(bikePath).toBeVisible();
  });

  /** Mobile puts search on its own full-width row above the filters. */
  test('stacks search above the filters on mobile', async ({
    authenticatedPage,
    org,
  }) => {
    await authenticatedPage.setViewportSize({ width: 360, height: 800 });
    const { slug, name } = await createSearchListing(org);

    await authenticatedPage.goto(`/en/decisions/${slug}/current?filter=all`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      authenticatedPage.getByRole('heading', { name, level: 2 }),
    ).toBeVisible({ timeout: 30_000 });

    const searchField = authenticatedPage.getByRole('searchbox', {
      name: 'Search proposals',
    });
    // The trigger's accessible name is its current value on mobile and
    // "<value> Filter proposals" on desktop — substring matches both.
    const filterSelect = authenticatedPage.getByRole('button', {
      name: 'All proposals',
    });
    await expect(searchField).toBeVisible({ timeout: 15_000 });

    const search = await searchField.boundingBox();
    const filter = await filterSelect.boundingBox();
    if (!search || !filter) {
      throw new Error(
        'Expected both the search field and filter select to lay out',
      );
    }

    // Fully above the filter row, not beside it.
    expect(search.y + search.height).toBeLessThanOrEqual(filter.y);
    // Spans the row, rather than sitting inline in the scrollable filter strip.
    // Short of the 328px content width because the icon addon takes the inset.
    expect(search.width).toBeGreaterThan(270);
    // Same height as the selects it sits above — compared rather than hardcoded,
    // so it tracks whatever the shared control height becomes.
    expect(Math.abs(search.height - filter.height)).toBeLessThanOrEqual(2);
  });
});
