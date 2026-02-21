import type { ProposalTemplateSchema } from '@op/common';
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
import {
  createDecisionInstance,
  createProposal,
  getSeededTemplate,
} from '@op/test';
import { randomUUID } from 'node:crypto';

import { transformFormDataToProcessSchema as cowopSchema } from '../../../apps/app/src/components/Profile/CreateDecisionProcessModal/schemas/cowop';
import { expect, test } from '../fixtures/index.js';

/**
 * Any doc ID that doesn't contain "nonexistent" will return fixture content
 * from the mock (@op/collab/testing, aliased via webpack when E2E=true).
 */
const MOCK_DOC_ID = 'test-proposal-doc';

test.describe('Proposal View', () => {
  test('renders formatted content from TipTap document', async ({
    authenticatedPage,
    org,
  }) => {
    const template = await getSeededTemplate();

    const newSchemaTemplate = {
      type: 'object' as const,
      required: ['title'],
      'x-field-order': [
        'title',
        'budget',
        'category',
        'priority',
        'region',
        'summary',
      ],
      properties: {
        title: {
          type: 'string' as const,
          title: 'Title',
          'x-format': 'short-text',
        },
        budget: {
          type: 'number' as const,
          title: 'Budget',
          'x-format': 'money',
        },
        category: {
          type: ['string', 'null'],
          title: 'Category',
          'x-format': 'dropdown' as const,
          oneOf: [
            { const: 'Renewable Energy', title: 'Renewable Energy' },
            { const: 'Community Development', title: 'Community Development' },
          ],
        },
        priority: {
          type: ['string', 'null'],
          title: 'Priority Level',
          'x-format': 'dropdown' as const,
          oneOf: [
            { const: 'high', title: 'High' },
            { const: 'medium', title: 'Medium' },
            { const: 'low', title: 'Low' },
          ],
        },
        region: {
          type: ['string', 'null'],
          title: 'Region',
          'x-format': 'dropdown' as const,
          oneOf: [
            { const: 'north', title: 'North' },
            { const: 'south', title: 'South' },
            { const: 'east', title: 'East' },
            { const: 'west', title: 'West' },
          ],
        },
        summary: {
          type: 'string' as const,
          title: 'Summary',
          'x-format': 'long-text',
        },
      },
    };

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
      proposalTemplate: newSchemaTemplate as ProposalTemplateSchema,
    });

    const proposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.organizationProfile.id,
      proposalData: {
        title: 'Community Solar Initiative',
        collaborationDocId: MOCK_DOC_ID,
        budget: { amount: 10000, currency: 'EUR' },
        category: 'Renewable Energy',
        priority: 'high',
        region: 'north',
      },
    });

    await authenticatedPage.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}`,
    );

    // Title rendered (wait for client-side hydration)
    await expect(
      authenticatedPage.getByRole('heading', {
        name: 'Community Solar Initiative',
      }),
    ).toBeVisible({ timeout: 30_000 });

    // Formatted text rendered with correct tags (use .first() because the mock
    // returns the same fixture content for every fragment, including dropdowns)
    await expect(
      authenticatedPage.locator('strong', { hasText: 'Bold text' }).first(),
    ).toBeVisible();
    await expect(
      authenticatedPage.locator('em', { hasText: 'italic text' }).first(),
    ).toBeVisible();

    // List items inside a list
    await expect(
      authenticatedPage.locator('li', { hasText: 'First item' }).first(),
    ).toBeVisible();
    await expect(
      authenticatedPage.locator('li', { hasText: 'Second item' }).first(),
    ).toBeVisible();

    // Link with correct href
    const link = authenticatedPage
      .locator('a', { hasText: 'Example link' })
      .first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://example.com');

    // Iframely embed node renders as a LinkPreview (fallback: URL shown as link)
    await expect(
      authenticatedPage.getByText('youtube.com').first(),
    ).toBeVisible();

    // New-format budget { value: 10000, currency: 'EUR' } rendered as "€10,000"
    await expect(authenticatedPage.getByText('€10,000')).toBeVisible();

    // Category value rendered in a Tag component on the proposal view
    await expect(authenticatedPage.getByText('Renewable Energy')).toBeVisible();

    // Dynamic dropdown fields render with their label via ProposalContentRenderer.
    // The field labels should be visible as section headings.
    await expect(
      authenticatedPage.getByText('Priority Level', { exact: true }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByText('Region', { exact: true }),
    ).toBeVisible();
  });

  test('renders legacy HTML description when no collaborationDocId exists', async ({
    authenticatedPage,
    org,
  }) => {
    const template = await getSeededTemplate();

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
    });

    // Legacy proposal: raw HTML in `description`, no collaborationDocId,
    // plain number budget (pre-currency-object format)
    const proposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.organizationProfile.id,
      proposalData: {
        title: 'Legacy HTML Proposal',
        description: [
          '<h2>Project Overview</h2>',
          '<p>This proposal has <strong>bold text</strong> and <em>italic text</em> in a legacy format.</p>',
          '<ul><li>First legacy item</li><li>Second legacy item</li></ul>',
          '<p>Contact us at <a href="https://example.org">our website</a>.</p>',
        ].join(''),
        budget: 5000,
      },
    });

    await authenticatedPage.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}`,
    );

    // Title renders
    await expect(
      authenticatedPage.getByRole('heading', {
        name: 'Legacy HTML Proposal',
      }),
    ).toBeVisible({ timeout: 30_000 });

    // Subheading from legacy HTML
    await expect(
      authenticatedPage.getByRole('heading', { name: 'Project Overview' }),
    ).toBeVisible();

    // Formatted text rendered with correct tags
    await expect(
      authenticatedPage.locator('strong', { hasText: 'bold text' }),
    ).toBeVisible();
    await expect(
      authenticatedPage.locator('em', { hasText: 'italic text' }),
    ).toBeVisible();

    // List items
    await expect(
      authenticatedPage.locator('li', { hasText: 'First legacy item' }),
    ).toBeVisible();
    await expect(
      authenticatedPage.locator('li', { hasText: 'Second legacy item' }),
    ).toBeVisible();

    // Link with correct href
    const link = authenticatedPage.locator('a', { hasText: 'our website' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://example.org');

    // Legacy plain-number budget (5000) is normalised to { value: 5000, currency: 'USD' }
    // and rendered as "$5,000" via formatCurrency
    await expect(authenticatedPage.getByText('$5,000')).toBeVisible();
  });

  test('renders legacy proposal with old template format and description field', async ({
    authenticatedPage,
    org,
  }) => {
    const template = await getSeededTemplate();

    // Legacy template shape: no x-format, no x-field-order, has a `description` property
    const legacyProposalTemplate = {
      type: 'object',
      required: ['title', 'description', 'budget'],
      properties: {
        title: { type: 'string' },
        budget: { type: 'number', maximum: 100000 },
        category: {
          enum: ['Ai. Direct funding to worker-owned co-ops.', 'other', null],
          type: ['string', 'null'],
        },
        description: { type: 'string' },
      },
    };

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
      proposalTemplate: legacyProposalTemplate as ProposalTemplateSchema,
    });

    // Legacy proposal: raw HTML in `description`, no collaborationDocId
    const proposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.organizationProfile.id,
      proposalData: {
        title: 'Legacy Template Proposal',
        description: [
          '<h2>Worker Co-op Plan</h2>',
          '<p>This proposal uses the <strong>old template format</strong> with a plain description field.</p>',
          '<ul><li>Support co-ops</li><li>Build sustainability</li></ul>',
        ].join(''),
        category: 'Ai. Direct funding to worker-owned co-ops.',
      },
    });

    await authenticatedPage.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}`,
    );

    // Title renders
    await expect(
      authenticatedPage.getByRole('heading', {
        name: 'Legacy Template Proposal',
      }),
    ).toBeVisible({ timeout: 30_000 });

    // Subheading from legacy HTML
    await expect(
      authenticatedPage.getByRole('heading', { name: 'Worker Co-op Plan' }),
    ).toBeVisible();

    // Formatted text rendered correctly
    await expect(
      authenticatedPage.locator('strong', {
        hasText: 'old template format',
      }),
    ).toBeVisible();

    // List items
    await expect(
      authenticatedPage.locator('li', { hasText: 'Support co-ops' }),
    ).toBeVisible();
    await expect(
      authenticatedPage.locator('li', { hasText: 'Build sustainability' }),
    ).toBeVisible();

    // Category value rendered in a Tag component on the proposal view
    await expect(
      authenticatedPage.getByText('Ai. Direct funding to worker-owned co-ops.'),
    ).toBeVisible();
  });

  /**
   * Simulates a real COWOP production instance where the proposalTemplate
   * lives in `decision_processes.process_schema` (not instanceData) and
   * budget is stored as a plain number. Verifies the full render path:
   * resolveProposalTemplate fallback → proposalDataSchema normalization → UI.
   *
   * @see https://github.com/oneprojectorg/common/pull/601#discussion_r2803602140
   */
  test('renders legacy cowop proposal with budget from process_schema', async ({
    authenticatedPage,
    org,
  }) => {
    // 1. Create a dedicated cowop decision process.
    //    The proposalTemplate in process_schema has budget: { type: 'number' },
    //    matching real COWOP production data. We generate it from the actual
    //    cowop schema function, then wrap it in a valid DecisionSchemaDefinition
    //    envelope so the getDecisionBySlug encoder doesn't reject it.
    const cowopLegacySchema = cowopSchema({
      processName: 'COWOP Democratic Budgeting',
      totalBudget: 100000,
      budgetCapAmount: 100000,
      requireBudget: true,
      categories: [
        'Ai. Direct funding to worker-owned co-ops.',
        'Bv. Support regional co-op organizing groups.',
        'other',
      ],
    });

    const cowopProcessSchema = {
      id: 'cowop-legacy',
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
      // The legacy proposalTemplate — budget is { type: 'number' }, no x-field-order
      proposalTemplate: cowopLegacySchema.proposalTemplate,
    };

    const [cowopProcess] = await db
      .insert(decisionProcesses)
      .values({
        name: `COWOP Test ${randomUUID().slice(0, 8)}`,
        description: 'Legacy cowop process for e2e testing',
        processSchema: cowopProcessSchema,
        createdByProfileId: org.organizationProfile.id,
      })
      .returning();

    if (!cowopProcess) {
      throw new Error('Failed to create cowop process');
    }

    // 2. Create the instance with COWOP-style instanceData (no proposalTemplate).
    //    Mirrors production: proposalTemplate is only in process_schema.
    const instanceSlug = `test-cowop-${randomUUID()}`;
    const instanceName = `COWOP Instance ${randomUUID().slice(0, 8)}`;

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

    // COWOP-style instanceData — no proposalTemplate, has fieldValues.
    // Must include currentPhaseId for the instanceDataWithSchemaEncoder.
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

    const [processInstance] = await db
      .insert(processInstances)
      .values({
        name: instanceName,
        processId: cowopProcess.id,
        profileId: instanceProfile.id,
        instanceData: cowopInstanceData,
        currentStateId: 'ideaCollection',
        status: ProcessStatus.PUBLISHED,
        ownerProfileId: org.organizationProfile.id,
      })
      .returning();

    if (!processInstance) {
      throw new Error('Failed to create process instance');
    }

    // 3. Grant admin access
    const [profileUser] = await db
      .insert(profileUsers)
      .values({
        profileId: instanceProfile.id,
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

    // 4. Create a proposal with legacy plain-number budget and description
    const proposal = await createProposal({
      processInstanceId: processInstance.id,
      submittedByProfileId: org.organizationProfile.id,
      proposalData: {
        title: 'Worker Co-op Equipment Fund',
        description:
          '<p>Requesting funds for <strong>equipment upgrades</strong> to support our worker-owned bakery.</p>',
        budget: 15000,
        category: 'Ai. Direct funding to worker-owned co-ops.',
      },
    });

    await authenticatedPage.goto(
      `/en/decisions/${instanceSlug}/proposal/${proposal.profileId}`,
    );

    // Title renders
    await expect(
      authenticatedPage.getByRole('heading', {
        name: 'Worker Co-op Equipment Fund',
      }),
    ).toBeVisible({ timeout: 30_000 });

    // Legacy plain-number budget (15000) normalised to { amount: 15000, currency: 'USD' }
    // and rendered as "$15,000"
    await expect(authenticatedPage.getByText('$15,000')).toBeVisible();

    // Category value rendered in a Tag component on the proposal view
    await expect(
      authenticatedPage.getByText('Ai. Direct funding to worker-owned co-ops.'),
    ).toBeVisible();

    // Description content renders
    await expect(
      authenticatedPage.locator('strong', {
        hasText: 'equipment upgrades',
      }),
    ).toBeVisible();
  });

  test('handles missing document gracefully', async ({
    authenticatedPage,
    org,
  }) => {
    const template = await getSeededTemplate();

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
    });

    // Use a collaborationDocId containing "nonexistent" — the e2e mock returns 404
    const proposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.organizationProfile.id,
      proposalData: {
        title: 'Missing Document Proposal',
        collaborationDocId: 'nonexistent-doc-id',
      },
    });

    await authenticatedPage.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}`,
    );

    // Title still renders (wait for client-side hydration)
    await expect(
      authenticatedPage.getByRole('heading', {
        name: 'Missing Document Proposal',
      }),
    ).toBeVisible({ timeout: 30_000 });

    // Fallback message shown instead of document content
    await expect(
      authenticatedPage.getByText('Content could not be loaded'),
    ).toBeVisible();
  });
});
