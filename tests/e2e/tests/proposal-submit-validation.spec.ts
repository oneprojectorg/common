import type { ProposalTemplateSchema } from '@op/common';
import { ProposalStatus } from '@op/db/schema';
import {
  createDecisionInstance,
  createProposal,
  getSeededTemplate,
} from '@op/test';

import { expect, test } from '../fixtures/index.js';

/**
 * Proposal template with all field types — every field is required.
 *
 * System fields: title, category, budget
 * Dynamic fields: summary (short-text), details (long-text),
 *                 priority (dropdown), region (dropdown)
 */
const ALL_FIELDS_TEMPLATE = {
  type: 'object' as const,
  required: [
    'title',
    'category',
    'budget',
    'summary',
    'details',
    'priority',
    'region',
  ],
  'x-field-order': [
    'title',
    'category',
    'budget',
    'summary',
    'details',
    'priority',
    'region',
  ],
  properties: {
    title: {
      type: 'string' as const,
      title: 'Title',
      'x-format': 'short-text' as const,
    },
    category: {
      type: ['string', 'null'] as const,
      title: 'Category',
      oneOf: [
        { const: 'Infrastructure', title: 'Infrastructure' },
        { const: 'Education', title: 'Education' },
        { const: 'Healthcare', title: 'Healthcare' },
      ],
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
      minLength: 1,
    },
    details: {
      type: 'string' as const,
      title: 'Details',
      description: 'Full proposal details and justification',
      'x-format': 'long-text' as const,
      minLength: 1,
    },
    priority: {
      type: ['string', 'null'] as const,
      title: 'Priority Level',
      'x-format': 'dropdown' as const,
      oneOf: [
        { const: 'high', title: 'High' },
        { const: 'medium', title: 'Medium' },
        { const: 'low', title: 'Low' },
      ],
    },
    region: {
      type: ['string', 'null'] as const,
      title: 'Region',
      'x-format': 'dropdown' as const,
      oneOf: [
        { const: 'north', title: 'North' },
        { const: 'south', title: 'South' },
        { const: 'east', title: 'East' },
        { const: 'west', title: 'West' },
      ],
    },
  },
} satisfies ProposalTemplateSchema;

test.describe('Proposal Submit Validation', () => {
  test('shows validation errors and reduces them as fields are fixed', async ({
    authenticatedPage,
    org,
  }) => {
    // -- Setup: create decision instance + empty draft proposal ----------------

    const template = await getSeededTemplate();

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: template.processSchema,
      proposalTemplate: ALL_FIELDS_TEMPLATE,
    });

    const proposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.organizationProfile.id,
      proposalData: { title: '' },
      status: ProposalStatus.DRAFT,
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    // -- Navigate to editor ---------------------------------------------------

    await authenticatedPage.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}/edit`,
      { waitUntil: 'networkidle' },
    );

    const submitButton = authenticatedPage.getByRole('button', {
      name: 'Submit Proposal',
    });
    await expect(submitButton).toBeVisible({ timeout: 30_000 });

    // Helper: dismiss any visible toasts before the next submit
    const dismissToasts = async () => {
      const toasts = authenticatedPage.locator('[data-sonner-toast]');
      const count = await toasts.count();
      for (let i = 0; i < count; i++) {
        const dismissBtn = toasts.nth(i).locator('button').last();
        if (await dismissBtn.isVisible()) {
          await dismissBtn.click();
        }
      }
      // Wait for toast to animate out
      await authenticatedPage.waitForTimeout(300);
    };

    // =========================================================================
    // Step 1: Submit with everything empty → expect 3 system field errors
    // (Title, Budget, Category)
    // =========================================================================

    await submitButton.click();

    const errorToast = authenticatedPage
      .locator('[data-sonner-toast]')
      .filter({ hasText: 'Please complete the following required fields:' });

    await expect(errorToast).toBeVisible({ timeout: 5_000 });
    await expect(errorToast).toContainText('Title');
    await expect(errorToast).toContainText('Budget');
    await expect(errorToast).toContainText('Category');

    await dismissToasts();

    // =========================================================================
    // Step 2: Fill in Title → re-submit → expect 2 errors (Budget, Category)
    // =========================================================================

    const titleEditor = authenticatedPage.locator('.ProseMirror.text-title-lg');
    await titleEditor.click();
    await authenticatedPage.keyboard.type('My Test Proposal');

    // Wait for debounced auto-save to fire
    await authenticatedPage.waitForTimeout(2_000);

    await submitButton.click();

    const errorToast2 = authenticatedPage
      .locator('[data-sonner-toast]')
      .filter({ hasText: 'Please complete the following required fields:' });

    await expect(errorToast2).toBeVisible({ timeout: 5_000 });
    await expect(errorToast2).not.toContainText('Title');
    await expect(errorToast2).toContainText('Budget');
    await expect(errorToast2).toContainText('Category');

    await dismissToasts();

    // =========================================================================
    // Step 3: Fill in Budget → re-submit → expect 1 error (Category)
    // =========================================================================

    const addBudgetButton = authenticatedPage.getByRole('button', {
      name: 'Add budget',
    });
    await addBudgetButton.click();

    const budgetInput = authenticatedPage.getByPlaceholder('Enter amount');
    await expect(budgetInput).toBeVisible({ timeout: 5_000 });
    await budgetInput.fill('5000');
    await budgetInput.blur();

    await authenticatedPage.waitForTimeout(2_000);

    await submitButton.click();

    const errorToast3 = authenticatedPage
      .locator('[data-sonner-toast]')
      .filter({ hasText: 'Please complete the following required fields:' });

    await expect(errorToast3).toBeVisible({ timeout: 5_000 });
    await expect(errorToast3).not.toContainText('Title');
    await expect(errorToast3).not.toContainText('Budget');
    await expect(errorToast3).toContainText('Category');

    await dismissToasts();

    // =========================================================================
    // Step 4: Select Category → re-submit
    //
    // After fixing all 3 system fields, the client-side validation passes.
    // The form should now also validate dynamic required fields (Summary,
    // Details, Priority Level, Region) before allowing submission.
    //
    // This assertion will FAIL on the current implementation because
    // client-side validation does not yet check dynamic required fields.
    // =========================================================================

    const categoryButton = authenticatedPage.getByRole('button', {
      name: 'Select category',
    });
    await categoryButton.click();
    await authenticatedPage
      .getByRole('option', { name: 'Infrastructure' })
      .click();

    await authenticatedPage.waitForTimeout(2_000);

    await submitButton.click();

    // After fixing all system fields, submission should be blocked by
    // dynamic field validation. The toast should list the missing dynamic
    // required fields.
    const errorToast4 = authenticatedPage
      .locator('[data-sonner-toast]')
      .filter({ hasText: 'Please complete the following required fields:' });

    await expect(errorToast4).toBeVisible({ timeout: 5_000 });
    await expect(errorToast4).toContainText('Summary');
    await expect(errorToast4).toContainText('Details');
    await expect(errorToast4).toContainText('Priority Level');
    await expect(errorToast4).toContainText('Region');

    await dismissToasts();

    // =========================================================================
    // Step 5: Fill Summary → re-submit → 3 dynamic errors remain
    // =========================================================================

    // Locate by the exact field title label, then find the ProseMirror
    // editor within the same field wrapper (the parent flex container).
    const summaryLabel = authenticatedPage.getByText('Summary', {
      exact: true,
    });
    const summaryEditor = summaryLabel
      .locator('..')
      .locator('..')
      .locator('.ProseMirror');
    await summaryEditor.click();
    await authenticatedPage.keyboard.type('A brief summary of the proposal');

    await authenticatedPage.waitForTimeout(2_000);

    await submitButton.click();

    const errorToast5 = authenticatedPage
      .locator('[data-sonner-toast]')
      .filter({ hasText: 'Please complete the following required fields:' });

    await expect(errorToast5).toBeVisible({ timeout: 5_000 });
    await expect(errorToast5).not.toContainText('Summary');
    await expect(errorToast5).toContainText('Details');
    await expect(errorToast5).toContainText('Priority Level');
    await expect(errorToast5).toContainText('Region');

    await dismissToasts();

    // =========================================================================
    // Step 6: Fill Details → re-submit → 2 dynamic errors remain
    // =========================================================================

    const detailsLabel = authenticatedPage.getByText('Details', {
      exact: true,
    });
    const detailsEditor = detailsLabel
      .locator('..')
      .locator('..')
      .locator('.ProseMirror');
    await detailsEditor.click();
    await authenticatedPage.keyboard.type(
      'Full details and justification for this proposal',
    );

    await authenticatedPage.waitForTimeout(2_000);

    await submitButton.click();

    const errorToast6 = authenticatedPage
      .locator('[data-sonner-toast]')
      .filter({ hasText: 'Please complete the following required fields:' });

    await expect(errorToast6).toBeVisible({ timeout: 5_000 });
    await expect(errorToast6).not.toContainText('Summary');
    await expect(errorToast6).not.toContainText('Details');
    await expect(errorToast6).toContainText('Priority Level');
    await expect(errorToast6).toContainText('Region');

    await dismissToasts();

    // =========================================================================
    // Step 7: Select Priority Level → re-submit → 1 dynamic error remains
    // =========================================================================

    // Scope to the field wrapper by finding the label, then going up to
    // the parent container that holds both label and the Select button.
    const priorityLabel = authenticatedPage.getByText('Priority Level', {
      exact: true,
    });
    const priorityField = priorityLabel.locator('..').locator('..');
    await priorityField.getByRole('button', { name: 'Select option' }).click();
    await authenticatedPage.getByRole('option', { name: 'High' }).click();

    await authenticatedPage.waitForTimeout(2_000);

    await submitButton.click();

    const errorToast7 = authenticatedPage
      .locator('[data-sonner-toast]')
      .filter({ hasText: 'Please complete the following required fields:' });

    await expect(errorToast7).toBeVisible({ timeout: 5_000 });
    await expect(errorToast7).not.toContainText('Priority Level');
    await expect(errorToast7).toContainText('Region');

    await dismissToasts();

    // =========================================================================
    // Step 8: Select Region → re-submit → no errors, proposal submits
    // =========================================================================

    const regionLabel = authenticatedPage.getByText('Region', { exact: true });
    const regionField = regionLabel.locator('..').locator('..');
    await regionField.getByRole('button', { name: 'Select option' }).click();
    await authenticatedPage.getByRole('option', { name: 'North' }).click();

    await authenticatedPage.waitForTimeout(2_000);

    await submitButton.click();

    // Client-side validation should pass — no "required fields" toast.
    // The server may still reject (TipTap mock doesn't have the typed
    // content), but that's outside the scope of this test. We only care
    // that the frontend schema validator accepted all fields.
    await expect(
      authenticatedPage
        .locator('[data-sonner-toast]')
        .filter({ hasText: 'Please complete the following required fields:' }),
    ).not.toBeVisible({ timeout: 5_000 });
  });
});
