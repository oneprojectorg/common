import type { ProposalTemplateSchema } from '@op/common';
import { ProposalStatus } from '@op/db/schema';
import {
  createDecisionInstance,
  createProposal,
  getSeededTemplate,
} from '@op/test';

import { expect, test } from '../fixtures/index.js';

/** Proposal template with one long-text field to type the `/` trigger into. */
const LONG_TEXT_TEMPLATE = {
  type: 'object' as const,
  required: ['title', 'budget'],
  'x-field-order': ['title', 'budget', 'details'],
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
    details: {
      type: 'string' as const,
      title: 'Details',
      description: 'Full proposal details and justification',
      'x-format': 'long-text' as const,
    },
  },
} satisfies ProposalTemplateSchema;

test.describe('Proposal Editor Slash Commands', () => {
  test('typing "/" opens the menu and applies the picked block', async ({
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
      proposalTemplate: LONG_TEXT_TEMPLATE,
    });

    const proposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      proposalData: {
        title: 'Slash Command Test Proposal',
        budget: { amount: 5000, currency: 'USD' },
      },
      status: ProposalStatus.DRAFT,
    });

    // Give DB a moment to commit
    await new Promise((resolve) => setTimeout(resolve, 500));

    // -- Navigate to editor --------------------------------------------------

    // The menu used to render into its own `createRoot`, detached from the app
    // tree — so `useTranslations()` inside it threw for want of the next-intl
    // provider, and the throw escaped to `window.onerror` with no message
    // (next-intl strips it in production builds). Collect page errors so a
    // regression shows up as the error itself, not just a missing menu.
    const pageErrors: string[] = [];
    authenticatedPage.on('pageerror', (error) => {
      pageErrors.push(error.message || '<empty message>');
    });

    await authenticatedPage.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}/edit`,
      { waitUntil: 'domcontentloaded' },
    );

    await expect(
      authenticatedPage.getByRole('button', { name: 'Submit', exact: true }),
    ).toBeVisible({ timeout: 30_000 });

    const detailsSection = authenticatedPage.getByTestId('field-details');
    const detailsEditor = detailsSection.locator('[contenteditable="true"]');
    await expect(detailsEditor).toBeVisible();

    // -- Typing "/" opens the menu -------------------------------------------

    const menu = authenticatedPage.getByTestId('slash-commands-menu');
    await expect(menu).toBeHidden();

    await detailsEditor.click();
    await authenticatedPage.keyboard.type('/');

    await expect(menu).toBeVisible({ timeout: 5_000 });
    await expect(menu.getByRole('button', { name: /Heading 1/ })).toBeVisible();

    // -- Filtering narrows the list ------------------------------------------

    await authenticatedPage.keyboard.type('quote');
    await expect(menu.getByRole('button', { name: /Quote/ })).toBeVisible();
    await expect(menu.getByRole('button', { name: /Heading 1/ })).toBeHidden();

    // -- Clicking an item applies it and closes the menu ---------------------

    // Clicking, not just Enter: the button has to suppress the default
    // mousedown, or focus leaves the editor and the menu unmounts before the
    // click lands.
    await menu.getByRole('button', { name: /Quote/ }).click();
    await expect(menu).toBeHidden({ timeout: 5_000 });
    await expect(detailsSection.locator('blockquote')).toBeVisible();

    // The `/quote` query text is consumed by the command, not left behind.
    await expect(detailsEditor).not.toContainText('/quote');

    // -- The keyboard path picks the highlighted item ------------------------

    // "large" is a search term on Heading 1 only, so it is the highlighted item.
    await authenticatedPage.keyboard.type('/large');
    await expect(menu).toBeVisible({ timeout: 5_000 });
    await expect(menu.getByRole('button', { name: /Heading 1/ })).toBeVisible();
    await authenticatedPage.keyboard.press('Enter');
    await expect(menu).toBeHidden({ timeout: 5_000 });
    await expect(detailsSection.locator('h1')).toBeVisible();

    // -- Escape dismisses the menu without applying anything -----------------

    await authenticatedPage.keyboard.type('/');
    await expect(menu).toBeVisible({ timeout: 5_000 });
    await authenticatedPage.keyboard.press('Escape');
    await expect(menu).toBeHidden({ timeout: 5_000 });

    // -- Nothing reached window.onerror --------------------------------------

    expect(pageErrors).toEqual([]);
  });
});
