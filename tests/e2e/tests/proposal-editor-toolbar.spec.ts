import type { ProposalTemplateSchema } from '@op/common';
import { ProposalStatus } from '@op/db/schema';
import {
  createDecisionInstance,
  createProposal,
  getSeededTemplate,
} from '@op/test';

import { expect, test } from '../fixtures/index.js';

/**
 * Custom proposal template with two rich-text fields (short + long)
 * and a required budget field.
 */
const TWO_FIELD_TEMPLATE = {
  type: 'object' as const,
  required: ['title', 'budget'],
  'x-field-order': ['title', 'budget', 'summary', 'details'],
  properties: {
    title: {
      type: 'string' as const,
      title: 'Title',
      'x-format': 'short-text' as const,
    },
    budget: {
      type: 'number' as const,
      title: 'Budget',
      'x-format': 'money' as const,
    },
    summary: {
      type: 'string' as const,
      title: 'Summary',
      description: 'A brief overview of the proposal',
      'x-format': 'short-text' as const,
    },
    details: {
      type: 'string' as const,
      title: 'Details',
      description: 'Full proposal details and justification',
      'x-format': 'long-text' as const,
    },
  },
} satisfies ProposalTemplateSchema;

test.describe('Proposal Editor Toolbar', () => {
  test('shared toolbar applies formatting to the focused editor', async ({
    authenticatedPage,
    org,
  }) => {
    // -- Setup: create decision instance + draft proposal --------------------

    const template = await getSeededTemplate();

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
      proposalTemplate: TWO_FIELD_TEMPLATE,
    });

    const proposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.organizationProfile.id,
      proposalData: {
        title: 'Toolbar Test Proposal',
        budget: { amount: 5000, currency: 'USD' },
      },
      status: ProposalStatus.DRAFT,
    });

    // Give DB a moment to commit
    await new Promise((resolve) => setTimeout(resolve, 500));

    // -- Navigate to editor --------------------------------------------------

    await authenticatedPage.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}/edit`,
      { waitUntil: 'networkidle' },
    );

    // Wait for editor to fully load
    await expect(
      authenticatedPage.getByRole('button', { name: 'Submit Proposal' }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      authenticatedPage.getByText('Summary', { exact: true }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByText('Details', { exact: true }),
    ).toBeVisible();

    const summarySection = authenticatedPage.getByTestId('field-summary');
    const summaryEditor = summarySection.locator('[contenteditable="true"]');

    const detailsSection = authenticatedPage.getByTestId('field-details');
    const detailsEditor = detailsSection.locator('[contenteditable="true"]');

    // -- Toolbar should be visible but disabled when no editor is focused -----

    const boldButton = authenticatedPage.locator('button[title="Bold"]');
    const italicButton = authenticatedPage.locator('button[title="Italic"]');
    await expect(boldButton).toBeVisible();
    await expect(boldButton).toBeDisabled();

    // -- Step 1: Click into summary, toolbar becomes active ------------------

    await summaryEditor.click();

    // Toolbar buttons should now be enabled (an editor has focus)
    await expect(boldButton).toBeEnabled({ timeout: 5_000 });

    // Type text and select all
    await authenticatedPage.keyboard.type('Summary bold text');
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';
    await authenticatedPage.keyboard.press(`${modifier}+a`);

    // Apply bold via toolbar button
    await boldButton.click();

    // Verify bold is applied
    await expect(
      summarySection.locator('strong', { hasText: 'Summary bold text' }),
    ).toBeVisible();

    // Verify bold button shows active state (bg-gray-200 class)
    await expect(boldButton).toHaveClass(/bg-gray-200/);

    // -- Step 2: Click into details, apply italic via toolbar -----------------

    await detailsEditor.click();
    await authenticatedPage.keyboard.type('Details italic text');
    await authenticatedPage.keyboard.press(`${modifier}+a`);

    // Apply italic via toolbar button
    await italicButton.click();

    // Verify italic is applied
    await expect(
      detailsSection.locator('em', { hasText: 'Details italic text' }),
    ).toBeVisible();

    // Verify italic button shows active state
    await expect(italicButton).toHaveClass(/bg-gray-200/);

    // Bold button should NOT be active (we're in details, which has no bold)
    await expect(boldButton).not.toHaveClass(/bg-gray-200/);

    // -- Step 3: Verify summary still has bold (formatting persisted) ---------

    await expect(
      summarySection.locator('strong', { hasText: 'Summary bold text' }),
    ).toBeVisible();

    // -- Step 4: Click back into summary, verify toolbar state updates --------

    await summaryEditor.click();
    await authenticatedPage.keyboard.press(`${modifier}+a`);

    // Bold button should now be active again (reflecting summary's bold state)
    await expect(boldButton).toHaveClass(/bg-gray-200/);

    // Italic button should NOT be active (summary has no italic)
    await expect(italicButton).not.toHaveClass(/bg-gray-200/);

    // Bold text still there
    await expect(
      summarySection.locator('strong', { hasText: 'Summary bold text' }),
    ).toBeVisible();
  });
});
