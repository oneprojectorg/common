import {
  createDecisionInstance,
  createProposal,
  getSeededTemplate,
} from '@op/test';

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
      proposalData: {
        title: 'Community Solar Initiative',
        collaborationDocId: MOCK_DOC_ID,
        budget: { value: 10000, currency: 'EUR' },
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

    // Formatted text rendered with correct tags
    await expect(
      authenticatedPage.locator('strong', { hasText: 'Bold text' }),
    ).toBeVisible();
    await expect(
      authenticatedPage.locator('em', { hasText: 'italic text' }),
    ).toBeVisible();

    // List items inside a list
    await expect(
      authenticatedPage.locator('li', { hasText: 'First item' }),
    ).toBeVisible();
    await expect(
      authenticatedPage.locator('li', { hasText: 'Second item' }),
    ).toBeVisible();

    // Link with correct href
    const link = authenticatedPage.locator('a', { hasText: 'Example link' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://example.com');

    // Iframely embed renders YouTube URL as a link card (no iframely API in e2e)
    await expect(
      authenticatedPage.locator(
        'a[href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"]',
      ),
    ).toBeVisible();

    // New-format budget { value: 10000, currency: 'EUR' } rendered as "€10,000"
    await expect(authenticatedPage.getByText('€10,000')).toBeVisible();
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
      proposalTemplate: legacyProposalTemplate,
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
