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
      type: 'object' as const,
      title: 'Budget',
      'x-format': 'money' as const,
      properties: {
        amount: { type: 'number' as const },
        currency: { type: 'string' as const, default: 'USD' },
      },
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

test.describe('Proposal Editor Bubble Menu', () => {
  test('per-field bubble menu applies formatting to the selection', async ({
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
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      proposalData: {
        title: 'Toolbar Test Proposal',
        budget: { amount: 5000, currency: 'USD' },
      },
      status: ProposalStatus.DRAFT,
    });

    // Give DB a moment to commit
    await new Promise((resolve) => setTimeout(resolve, 500));

    // -- Navigate to editor --------------------------------------------------

    // Guard against duplicate tiptap extension registrations (e.g. StarterKit
    // majors bundling extensions we also add explicitly). Duplicates register
    // their ProseMirror plugins/keymaps twice and tiptap warns on the console.
    const tiptapWarnings: string[] = [];
    authenticatedPage.on('console', (message) => {
      if (message.text().includes('[tiptap warn]')) {
        tiptapWarnings.push(message.text());
      }
    });

    await authenticatedPage.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}/edit`,
      { waitUntil: 'domcontentloaded' },
    );

    // Wait for editor to fully load
    await expect(
      authenticatedPage.getByRole('button', { name: 'Submit', exact: true }),
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

    // Each prose field renders its own menu (unique pluginKey per fragment), so
    // scope every lookup to the one that is currently open.
    const bubbleMenu = authenticatedPage.getByTestId('rich-text-bubble-menu');
    const boldButton = bubbleMenu.getByRole('button', { name: 'Bold' });
    const italicButton = bubbleMenu.getByRole('button', { name: 'Italic' });

    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';

    // -- No toolbar, and no menu until there is a selection -------------------

    // The shared toolbar above the form is gone; formatting is selection-scoped.
    await expect(authenticatedPage.locator('button[title="Bold"]')).toHaveCount(
      0,
    );
    await expect(bubbleMenu).toBeHidden();

    // -- Step 1: select text in summary, apply bold from the menu -------------

    await summaryEditor.click();
    await authenticatedPage.keyboard.type('Summary bold text');

    // A collapsed caret is not a selection — still no menu.
    await expect(bubbleMenu).toBeHidden();

    await authenticatedPage.keyboard.press(`${modifier}+a`);
    await expect(bubbleMenu).toBeVisible({ timeout: 5_000 });

    await boldButton.click();
    await expect(
      summarySection.locator('strong', { hasText: 'Summary bold text' }),
    ).toBeVisible();
    await expect(boldButton).toHaveAttribute('aria-pressed', 'true');

    // -- Step 2: the details field gets its own menu and its own state --------

    // `focus()`, not `click()`: the menu open over the summary selection floats
    // across the field below it, so a click aimed at another field can land on
    // the menu instead. Moving focus directly keeps the step about the editors.
    await detailsEditor.focus();
    await authenticatedPage.keyboard.type('Details italic text');
    await authenticatedPage.keyboard.press(`${modifier}+a`);
    await expect(bubbleMenu).toBeVisible({ timeout: 5_000 });

    await italicButton.click();
    await expect(
      detailsSection.locator('em', { hasText: 'Details italic text' }),
    ).toBeVisible();
    await expect(italicButton).toHaveAttribute('aria-pressed', 'true');

    // Bold is not active here — this menu reflects the details selection only.
    await expect(boldButton).toHaveAttribute('aria-pressed', 'false');

    // -- Step 3: summary keeps its bold --------------------------------------

    await expect(
      summarySection.locator('strong', { hasText: 'Summary bold text' }),
    ).toBeVisible();

    // -- Step 4: reselecting summary reflects its own marks ------------------

    await summaryEditor.focus();
    await authenticatedPage.keyboard.press(`${modifier}+a`);
    await expect(bubbleMenu).toBeVisible({ timeout: 5_000 });
    await expect(boldButton).toHaveAttribute('aria-pressed', 'true');
    await expect(italicButton).toHaveAttribute('aria-pressed', 'false');

    // -- Step 5: text alignment is available (it was toolbar-only before) -----

    await expect(
      bubbleMenu.getByRole('button', { name: 'Align Center' }),
    ).toBeVisible();

    // -- Step 6: collapsing the selection dismisses the menu -----------------

    await authenticatedPage.keyboard.press('ArrowRight');
    await expect(bubbleMenu).toBeHidden({ timeout: 5_000 });

    // -- No duplicate tiptap extension registrations --------------------------

    expect(tiptapWarnings).toEqual([]);
  });
});
