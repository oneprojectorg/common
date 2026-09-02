import type { ProposalTemplateSchema } from '@op/common';
import {
  EntityType,
  ProcessStatus,
  ProposalStatus,
  decisionProcesses,
  postReactions,
  posts,
  postsToProfiles,
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
  makeDecisionPublic,
} from '@op/test';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import { transformFormDataToProcessSchema as cowopSchema } from '../../../apps/app/src/components/Profile/CreateDecisionProcessModal/schemas/cowop';
import { authenticateAnonymously, expect, test } from '../fixtures/index.js';

/**
 * Any doc ID that doesn't contain "nonexistent" will return fixture content
 * from the mock (@op/collab/testing, aliased via webpack when E2E=true).
 */
const MOCK_DOC_ID = 'test-proposal-view-doc';
const VERSIONED_MOCK_DOC_ID = 'test-proposal-doc-versioned';

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
          type: 'object' as const,
          title: 'Budget',
          'x-format': 'money',
          properties: {
            amount: { type: 'number' as const },
            currency: { type: 'string' as const, default: 'USD' },
          },
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
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      proposalData: {
        title: 'Community Solar Initiative',
        collaborationDocId: MOCK_DOC_ID,
        budget: { amount: 10000, currency: 'EUR' },
        category: 'Renewable Energy',
        priority: 'high',
        region: 'north',
      },
    });

    // Guard against duplicate tiptap extension registrations in the viewer /
    // RichTextRenderer path (serverExtensions) — tiptap warns on the console.
    const tiptapWarnings: string[] = [];
    authenticatedPage.on('console', (message) => {
      if (message.text().includes('[tiptap warn]')) {
        tiptapWarnings.push(message.text());
      }
    });

    await authenticatedPage.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}`,
    );

    // Title rendered from the collab title fragment.
    await expect(
      authenticatedPage.getByRole('heading', {
        name: 'Community Solar Initiative',
      }),
    ).toBeVisible({ timeout: 30_000 });

    // Formatted text rendered from the summary fragment.
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

    // Budget and category rendered from collab system-field fragments.
    await expect(authenticatedPage.getByText('€10,000').first()).toBeVisible();
    await expect(
      authenticatedPage.getByText('Renewable Energy').first(),
    ).toBeVisible();

    // Non-last phase + no selection: the page must not surface the
    // "{amount} requested" secondary label, since there is no allocated value
    // to compare against.
    await expect(authenticatedPage.getByText(/requested/i)).toHaveCount(0);

    // Dynamic dropdown fields render with their label via ProposalContentRenderer.
    // The field labels should be visible as section headings.
    await expect(
      authenticatedPage.getByText('Priority Level', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByText('Region', { exact: true }).first(),
    ).toBeVisible();

    // No duplicate tiptap extension registrations.
    expect(tiptapWarnings).toEqual([]);
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
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
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
      authenticatedPage.locator('strong', { hasText: 'bold text' }).first(),
    ).toBeVisible();
    await expect(
      authenticatedPage.locator('em', { hasText: 'italic text' }).first(),
    ).toBeVisible();

    // List items
    await expect(
      authenticatedPage.locator('li', { hasText: 'First legacy item' }).first(),
    ).toBeVisible();
    await expect(
      authenticatedPage
        .locator('li', { hasText: 'Second legacy item' })
        .first(),
    ).toBeVisible();

    // Link with correct href
    const link = authenticatedPage
      .locator('a', { hasText: 'our website' })
      .first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://example.org');

    // Legacy plain-number budget (5000) is normalised to { value: 5000, currency: 'USD' }
    // and rendered as "$5,000" via formatCurrency
    await expect(authenticatedPage.getByText('$5,000').first()).toBeVisible();
  });

  test('uses checkpointed collab content for submitted proposals and latest content for drafts', async ({
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

    const submittedProposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      status: ProposalStatus.SUBMITTED,
      proposalData: {
        title: 'Submitted Versioned Proposal',
        collaborationDocId: VERSIONED_MOCK_DOC_ID,
        collaborationDocVersionId: 2,
      },
    });

    const draftProposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      status: ProposalStatus.DRAFT,
      proposalData: {
        title: 'Draft Versioned Proposal',
        collaborationDocId: VERSIONED_MOCK_DOC_ID,
        collaborationDocVersionId: 2,
      },
    });

    await authenticatedPage.goto(
      `/en/decisions/${instance.slug}/proposal/${submittedProposal.profileId}`,
    );
    await expect(
      authenticatedPage.getByRole('heading', {
        name: 'Version 2 checkpoint content',
      }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      authenticatedPage.getByRole('heading', { name: 'Latest draft content' }),
    ).not.toBeVisible();

    await authenticatedPage.goto(
      `/en/decisions/${instance.slug}/proposal/${draftProposal.profileId}`,
    );
    await expect(
      authenticatedPage.getByRole('heading', { name: 'Latest draft content' }),
    ).toBeVisible({ timeout: 30_000 });
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
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
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
      authenticatedPage
        .locator('strong', {
          hasText: 'old template format',
        })
        .first(),
    ).toBeVisible();

    // List items
    await expect(
      authenticatedPage.locator('li', { hasText: 'Support co-ops' }).first(),
    ).toBeVisible();
    await expect(
      authenticatedPage
        .locator('li', { hasText: 'Build sustainability' })
        .first(),
    ).toBeVisible();

    // Category value rendered in a Tag component on the proposal view
    await expect(
      authenticatedPage
        .getByText('Ai. Direct funding to worker-owned co-ops.')
        .first(),
    ).toBeVisible();
  });

  /**
   * Real COWOP production instance: state-based legacy schema, plain-number
   * budget on both processSchema.proposalTemplate and proposalData. Verifies
   * the page doesn't 500 on legacy shape (regression #1001) and that the
   * resolveProposalTemplate fallback → proposalDataSchema normalization → UI
   * render path produces the expected output.
   *
   * @see https://github.com/oneprojectorg/common/pull/601#discussion_r2803602140
   */
  test('renders legacy cowop proposal with budget from process_schema', async ({
    authenticatedPage,
    org,
  }) => {
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

    const [cowopProcess] = await db
      .insert(decisionProcesses)
      .values({
        name: `COWOP Test ${randomUUID().slice(0, 8)}`,
        processSchema: cowopLegacySchema,
        createdByProfileId: org.organizationProfile.id,
      })
      .returning();

    if (!cowopProcess) {
      throw new Error('Failed to create cowop process');
    }

    const instanceName = `COWOP Instance ${randomUUID().slice(0, 8)}`;

    const [instanceProfile] = await db
      .insert(profiles)
      .values({
        name: instanceName,
        slug: `test-cowop-${randomUUID()}`,
        type: EntityType.DECISION,
      })
      .returning();

    if (!instanceProfile) {
      throw new Error('Failed to create instance profile');
    }

    const cowopInstanceData = {
      budget: 100000,
      hideBudget: false,
      phases: [
        {
          stateId: 'ideaCollection',
          plannedStartDate: '2025-09-20',
          plannedEndDate: '2025-10-01',
        },
        {
          stateId: 'submission',
          plannedStartDate: '2025-10-02',
          plannedEndDate: '2025-10-20',
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

    const proposal = await createProposal({
      processInstanceId: processInstance.id,
      submittedByProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      proposalData: {
        title: 'Worker Co-op Equipment Fund',
        description:
          '<p>Requesting funds for <strong>equipment upgrades</strong> to support our worker-owned bakery.</p>',
        budget: 15000,
        category: 'Ai. Direct funding to worker-owned co-ops.',
      },
    });

    // Real cowop legacy proposals are served via the legacy URL pattern.
    await authenticatedPage.goto(
      `/en/profile/${org.organizationProfile.slug}/decisions/${processInstance.id}/proposal/${proposal.profileId}`,
    );

    await expect(
      authenticatedPage.getByRole('heading', {
        name: 'Worker Co-op Equipment Fund',
      }),
    ).toBeVisible({ timeout: 30_000 });

    // Plain-number budget (15000) normalised to { amount: 15000, currency: 'USD' }.
    await expect(authenticatedPage.getByText('$15,000').first()).toBeVisible();

    await expect(
      authenticatedPage
        .getByText('Ai. Direct funding to worker-owned co-ops.')
        .first(),
    ).toBeVisible();

    await expect(
      authenticatedPage
        .locator('strong', {
          hasText: 'equipment upgrades',
        })
        .first(),
    ).toBeVisible();
  });

  test('allows posting a comment on the proposal view', async ({
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

    const proposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      proposalData: {
        title: 'Commentable Proposal',
      },
    });

    await authenticatedPage.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}`,
    );

    await expect(
      authenticatedPage.getByRole('heading', { name: 'Commentable Proposal' }),
    ).toBeVisible({ timeout: 30_000 });

    // Comments section starts empty with the write-mode empty state.
    await expect(
      authenticatedPage.getByRole('heading', { name: 'Comments (0)' }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByText('Be the first to comment').first(),
    ).toBeVisible();

    const commentText = 'This is a great proposal — looking forward to it!';
    const commentBox = authenticatedPage.getByPlaceholder(/^Comment/);
    await expect(commentBox).toBeVisible();
    await commentBox.fill(commentText);

    await authenticatedPage
      .getByRole('button', { name: 'Comment', exact: true })
      .click();

    // After post the comment appears in the feed and the counter increments.
    await expect(authenticatedPage.getByText(commentText)).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      authenticatedPage.getByRole('heading', { name: 'Comments (1)' }),
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
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      proposalData: {
        title: 'Missing Document Proposal',
        collaborationDocId: 'nonexistent-doc-id',
      },
    });

    await authenticatedPage.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}`,
    );

    // Title still renders (wait for client-side hydration). The document fetch
    // failing no longer takes down the whole page — title/budget/metadata show
    // regardless.
    await expect(
      authenticatedPage.getByRole('heading', {
        name: 'Missing Document Proposal',
      }),
    ).toBeVisible({ timeout: 30_000 });

    // A failed fetch is treated as "unavailable" first: the viewer polls in
    // case the document is still propagating, and only renders the fallback
    // once the bounded wait elapses (so a still-syncing doc doesn't flash an
    // error). The doc here is permanently missing, so the fallback appears
    // after the poll window — wait past it.
    await expect(
      authenticatedPage.getByText('Content could not be loaded').first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test('gates write actions per viewer: post like/Like/Follow members-only, Report visible to all', async ({
    authenticatedPage,
    org,
    browser,
  }) => {
    const template = await getSeededTemplate();

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
    });

    const proposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      status: ProposalStatus.SUBMITTED,
      proposalData: { title: 'Reactable Proposal' },
    });

    // Public decision so anonymous and logged-out visitors can read it.
    await makeDecisionPublic({ profileId: instance.profileId });

    // Likes render per-comment; seed a top-level post + like on the proposal.
    const commentText = 'Seeded comment carrying a like';
    const [comment] = await db
      .insert(posts)
      .values({ content: commentText, profileId: org.organizationProfile.id })
      .returning();
    if (!comment) {
      throw new Error('Failed to seed comment');
    }
    await db.insert(postsToProfiles).values({
      postId: comment.id,
      profileId: proposal.profileId,
    });
    await db.insert(postReactions).values({
      postId: comment.id,
      profileId: org.organizationProfile.id,
      reactionType: 'like',
    });

    const proposalUrl = `/en/decisions/${instance.slug}/proposal/${proposal.profileId}`;

    // Every viewer sees the proposal, the comment, the seeded like, and the
    // Report action (moderation is open to any caller). Only a signed-in
    // member also gets the interact-only write controls (the comment's like
    // toggle, Like, Follow).
    const expectProposalView = async (
      page: Page,
      { canInteract }: { canInteract: boolean },
    ) => {
      await page.goto(proposalUrl);
      await expect(
        page.getByRole('heading', { name: 'Reactable Proposal' }),
      ).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(commentText)).toBeVisible();

      // The comment's like button renders for everyone so read-only viewers
      // still see the seeded count; only a member gets it as a real toggle. It
      // draws just the heart and the number, so "1 like" is its aria-label.
      // Anchored regex, not the string form: `name` as a string matches
      // case-insensitively on a substring, so '1 like' would also pick up the
      // proposal-level "N Likes" stat and "11 likes".
      const commentLike = page.getByRole('button', { name: /^1 like$/ });
      await expect(commentLike).toBeVisible();
      if (canInteract) {
        await expect(commentLike).toHaveAttribute('aria-pressed', 'false');
      } else {
        await expect(commentLike).toHaveAttribute('aria-disabled', 'true');
      }

      // The like and follow toggles are named by the stat they show
      // ("0 Likes"), so match the noun rather than a bare verb.
      const writeControls = [
        page.getByRole('button', { name: /^\d+ Likes?$/ }),
        page.getByRole('button', { name: /^\d+ Followers?$/ }),
      ];
      for (const control of writeControls) {
        await expect(control).toHaveCount(canInteract ? 1 : 0);
      }

      // A count of 0 above is satisfied by the stats vanishing as well as by
      // them rendering as plain text, so assert the text is there either way —
      // read-only viewers still see the counts, just not as toggles.
      await expect(page.getByText(/^\d+ Likes?$/)).toBeVisible();
      await expect(page.getByText(/^\d+ Followers?$/)).toBeVisible();

      await expect(
        page.getByRole('button', { name: 'Report', exact: true }),
      ).toHaveCount(1);
    };

    // A clean context so the worker's auth doesn't leak in via newContext().
    const withCleanPage = async (fn: (page: Page) => Promise<void>) => {
      const context = await browser.newContext({
        storageState: { cookies: [], origins: [] },
      });
      try {
        await fn(await context.newPage());
      } finally {
        await context.close();
      }
    };

    // 1) Signed-in member: reactions/Like/Follow + Report all visible.
    await expectProposalView(authenticatedPage, { canInteract: true });

    // 2) Anonymous account: reactions/Like/Follow hidden, Report still visible.
    await withCleanPage(async (page) => {
      await authenticateAnonymously(page);
      await expectProposalView(page, { canInteract: false });
    });
    // 3) Logged-out visitor: same as anonymous — read-only but can still report.
    await withCleanPage((page) =>
      expectProposalView(page, { canInteract: false }),
    );
  });
});
