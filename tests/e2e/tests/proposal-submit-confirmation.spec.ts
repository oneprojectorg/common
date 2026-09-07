import type {
  DecisionSchemaDefinition,
  ProposalTemplateSchema,
} from '@op/common';
import { ProposalStatus } from '@op/db/schema';
import {
  createDecisionInstance,
  createProposal,
  getSeededTemplate,
} from '@op/test';
import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures/index.js';

/** Sonner toasts also carry `role="alertdialog"`, and this page raises one. */
const confirmDialog = (page: Page) =>
  page.getByRole('alertdialog').and(page.locator(':not([data-slot="toast"])'));

const validationToast = (page: Page) =>
  page
    .locator('[data-slot="toast"]')
    .filter({ hasText: 'Please fix the following issues:' });

/** Title is the only required field, so one keystroke clears validation. */
const TITLE_ONLY_TEMPLATE = {
  type: 'object' as const,
  required: ['title'],
  'x-field-order': ['title'],
  properties: {
    title: {
      type: 'string' as const,
      title: 'Title',
      'x-format': 'short-text' as const,
    },
  },
} satisfies ProposalTemplateSchema;

/**
 * Records every `decision.submitProposal` request the page fires, so a test can
 * assert that dismissing the dialog submitted *nothing* — the redirect is not a
 * usable signal here (the server can reject under the TipTap mock, as
 * `proposal-submit-validation.spec.ts` documents).
 */
const trackSubmitRequests = (page: Page): Array<string> => {
  const submits: Array<string> = [];
  page.on('request', (request) => {
    if (request.url().includes('decision.submitProposal')) {
      submits.push(request.url());
    }
  });
  return submits;
};

/** Opens the editor on a seeded draft; the draft is invalid until `fillTitle`. */
const openEditor = async ({
  page,
  org,
  allowEditAfterSubmission,
}: {
  page: Page;
  org: {
    organizationProfile: { id: string };
    adminUser: { authUserId: string; email: string };
  };
  allowEditAfterSubmission: boolean;
}) => {
  const template = await getSeededTemplate();
  // Only the submission phase matters — it's the one current when a draft is
  // submitted, and its `proposals.edit` rule is what the dialog keys on.
  const [submissionPhase, ...laterPhases] = template.processSchema.phases;
  const schema: DecisionSchemaDefinition = allowEditAfterSubmission
    ? {
        ...template.processSchema,
        phases: [
          {
            ...submissionPhase,
            rules: {
              ...submissionPhase.rules,
              proposals: { ...submissionPhase.rules.proposals, edit: true },
            },
          },
          ...laterPhases,
        ],
      }
    : template.processSchema;

  const instance = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema,
    proposalTemplate: TITLE_ONLY_TEMPLATE,
  });

  const proposal = await createProposal({
    processInstanceId: instance.instance.id,
    submittedByProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    proposalData: { title: '' },
    status: ProposalStatus.DRAFT,
  });

  await page.goto(
    `/en/decisions/${instance.slug}/proposal/${proposal.profileId}/edit`,
    { waitUntil: 'domcontentloaded' },
  );

  const submitButton = page.getByRole('button', {
    name: 'Submit',
    exact: true,
  });
  await expect(submitButton).toBeVisible({ timeout: 36_000 });

  return { submitButton };
};

/** The seeded draft is invalid until this runs — title is the only requirement. */
const fillTitle = async (page: Page) => {
  // The client validates against the Yjs document, not the seeded row, so the
  // title has to be typed rather than seeded.
  const titleEditor = page.getByTestId('field-title').getByRole('textbox');
  await titleEditor.click();
  await page.keyboard.type('Confirmation Test Proposal');
  // The collaborative field commits on a debounce; same wait as the sibling
  // spec, which types into these editors between submits.
  await page.waitForTimeout(2_400);
};

test.describe('Proposal Submit Confirmation', () => {
  // Validation runs ahead of the confirmation, so an incomplete draft gets its
  // errors rather than a prompt about a submission it can't reach. Swap the two
  // checks in the editor and this is what catches it.
  test('shows validation errors instead of the confirmation for an incomplete draft', async ({
    authenticatedPage,
    org,
  }) => {
    const { submitButton } = await openEditor({
      page: authenticatedPage,
      org,
      allowEditAfterSubmission: false,
    });

    await submitButton.click();

    await expect(validationToast(authenticatedPage)).toBeVisible({
      timeout: 6_000,
    });
    await expect(confirmDialog(authenticatedPage)).toBeHidden();
  });

  test('confirms before submitting a draft when the phase forbids later edits', async ({
    authenticatedPage,
    org,
  }) => {
    const submits = trackSubmitRequests(authenticatedPage);
    const { submitButton } = await openEditor({
      page: authenticatedPage,
      org,
      allowEditAfterSubmission: false,
    });
    await fillTitle(authenticatedPage);

    // -- Keep editing: nothing is submitted, the editor stays put ------------

    await submitButton.click();

    const dialog = confirmDialog(authenticatedPage);
    await expect(dialog).toBeVisible({ timeout: 6_000 });
    await expect(dialog).toContainText('Submitting is final');

    await dialog.getByRole('button', { name: 'Keep editing' }).click();

    await expect(dialog).toBeHidden({ timeout: 6_000 });
    await expect(authenticatedPage).toHaveURL(/\/edit(?:[/?#]|$)/);

    // -- Confirming submits --------------------------------------------------

    await submitButton.click();
    await expect(dialog).toBeVisible({ timeout: 6_000 });

    // Checked only now: a submit fired by "Keep editing" would have had a full
    // round trip to land by the time the dialog is back up.
    expect(submits).toEqual([]);

    const submitRequest = authenticatedPage.waitForRequest(
      (request) => request.url().includes('decision.submitProposal'),
      { timeout: 30_000 },
    );
    await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
    await submitRequest;
  });

  test('submits straight through when the phase allows editing after submission', async ({
    authenticatedPage,
    org,
  }) => {
    const { submitButton } = await openEditor({
      page: authenticatedPage,
      org,
      allowEditAfterSubmission: true,
    });
    await fillTitle(authenticatedPage);

    const submitRequest = authenticatedPage.waitForRequest(
      (request) => request.url().includes('decision.submitProposal'),
      { timeout: 30_000 },
    );
    await submitButton.click();
    await submitRequest;

    await expect(confirmDialog(authenticatedPage)).toBeHidden();
  });
});
