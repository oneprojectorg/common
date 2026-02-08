import {
  createDecisionInstance,
  createProposal,
  getSeededTemplate,
} from '@op/test';

import { expect, test } from '../fixtures/index.js';

/**
 * Any doc ID that doesn't contain "nonexistent" will return fixture content
 * from the e2e mock (@op/collab/e2e, aliased via webpack in next.config).
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
