import { expect, test } from '../fixtures/index.js';

// Use a wider viewport so the participant preview panel (xl:block >= 1280px) is visible.
test.use({ viewport: { width: 1440, height: 900 } });

/** Resolves when the next matching updateDecisionInstance mutation succeeds. */
function waitForAutoSave(
  page: import('@playwright/test').Page,
  requestBodyIncludes?: string,
) {
  return page.waitForResponse(
    (resp) => {
      if (
        !resp.url().includes('decision.updateDecisionInstance') ||
        !resp.ok()
      ) {
        return false;
      }

      if (!requestBodyIncludes) {
        return true;
      }

      return resp.request().postData()?.includes(requestBodyIncludes) ?? false;
    },
    { timeout: 12_000 },
  );
}

test.describe('Create Process Instance', () => {
  test('can create a decision process and reach launch-ready state', async ({
    authenticatedPage,
  }) => {
    test.setTimeout(144_000);

    // 1. Navigate to the decisions create page (server-side creates a draft
    //    instance from the seeded template and redirects to the editor)
    await authenticatedPage.goto('/en/decisions/create');

    // 2. Wait for the process builder editor to load
    await expect(authenticatedPage.getByText('Process Overview')).toBeVisible({
      timeout: 36_000,
    });

    // ── Step 1: General – Overview ──────────────────────────────────────

    // 3. Select the steward (current user — the first option in the dropdown)
    const stewardSelect = authenticatedPage.getByLabel(
      'Who is stewarding this process?',
    );
    await stewardSelect.click();
    const stewardOption = authenticatedPage
      .getByRole('listbox')
      .getByRole('option')
      .first();
    await expect(stewardOption).toBeVisible({ timeout: 6_000 });
    await stewardOption.click();

    // 4. Fill in the process name
    await authenticatedPage.getByLabel('Process Name').fill('E2E Test Process');

    // 5. Fill in the description — start listening for the auto-save response
    //    before the final input so we don't miss the debounced mutation
    const overviewSaved = waitForAutoSave(authenticatedPage);
    await authenticatedPage
      .getByLabel('Description')
      .fill('A process created by E2E tests');
    await overviewSaved;

    // ── Step 1: General – Phases ────────────────────────────────────────

    // 6. Navigate to the Phases section
    const sidebarNav = authenticatedPage.getByRole('navigation', {
      name: 'Section navigation',
    });
    const phasesButton = sidebarNav.getByRole('button', { name: 'Phases' });
    await expect(phasesButton).toBeVisible({ timeout: 18_000 });
    await phasesButton.click();

    await expect(
      authenticatedPage.getByText(
        'Define the phases of your decision-making process',
      ),
    ).toBeVisible({ timeout: 12_000 });

    // 7. Fill each phase's required fields.
    //    Click Configure on the first phase to enter the detail view, then
    //    use the footer Next button to advance through the remaining phases.
    const now = new Date();
    const phaseConfigureButtons = authenticatedPage.getByRole('button', {
      name: 'Configure',
    });
    await expect(phaseConfigureButtons.first()).toBeVisible({ timeout: 6_000 });
    const phaseCount = await phaseConfigureButtons.count();

    // Open the first phase detail form
    await phaseConfigureButtons.first().click();

    const nextButton = authenticatedPage.getByRole('button', { name: 'Next' });

    for (let i = 0; i < phaseCount; i++) {
      // Wait for the phase detail form to load
      const headlineField = authenticatedPage.getByLabel('Headline');
      await expect(headlineField).toBeVisible({ timeout: 6_000 });

      // Set up the auto-save listener before any field changes
      const phaseSaved = waitForAutoSave(authenticatedPage);

      // Fill phase name
      await authenticatedPage.getByLabel('Phase name').fill(`Phase ${i + 1}`);

      // Fill headline
      await headlineField.fill(`Phase ${i + 1} headline`);

      // Fill description
      await authenticatedPage
        .getByLabel('Description')
        .fill(`Description for phase ${i + 1}`);

      // Set end date — consecutive months from now
      const endDate = new Date(now.getFullYear(), now.getMonth() + i + 1, 15);
      const formatted = [
        String(endDate.getMonth() + 1).padStart(2, '0'),
        String(endDate.getDate()).padStart(2, '0'),
        endDate.getFullYear(),
      ].join('/');

      const endDateInput = authenticatedPage.getByLabel('End date');
      await endDateInput.fill(formatted);
      await endDateInput.press('Enter');

      // Wait for the auto-save to complete before advancing
      await phaseSaved;

      // Press Next to advance to the next phase (or to Proposal Categories
      // after the last phase)
      await nextButton.click();
    }

    // ── Step 1: General – Proposal Categories ───────────────────────────
    // (arrived here via Next from the last phase)

    await expect(
      authenticatedPage.getByText('Proposal Categories').first(),
    ).toBeVisible({ timeout: 12_000 });

    // 9. Create one category
    await authenticatedPage
      .getByRole('button', { name: 'Create first category' })
      .click();

    await authenticatedPage.getByLabel('Shorthand').fill('Education');
    await authenticatedPage
      .getByLabel('Full description')
      .fill('Expand access to quality education in underserved communities');

    // Start listening before the action that triggers auto-save
    const categorySaved = waitForAutoSave(authenticatedPage);
    await authenticatedPage
      .getByRole('button', { name: 'Add category' })
      .click();

    // Verify the category appears in the list
    await expect(
      authenticatedPage.getByText('Education', { exact: true }),
    ).toBeVisible();

    await categorySaved;

    // ── Step 2: Proposal Template ───────────────────────────────────────

    // 10. Navigate to the Proposal Template step
    const templateButton = sidebarNav.getByRole('button', {
      name: 'Proposal Template',
    });
    await templateButton.click();

    await expect(
      authenticatedPage.getByText('Proposal template').first(),
    ).toBeVisible({ timeout: 12_000 });

    // 11. Expand the Budget card — budget is enabled by default in the template
    //     Use a regex to match "Budget Optional" or "Budget Required" while
    //     excluding the "Add budget" button in the preview panel.
    await authenticatedPage
      .getByRole('button', { name: /^Budget (Optional|Required)$/ })
      .click();

    // Verify the toggle is already ON
    const showInTemplateToggle = authenticatedPage.getByTestId(
      'budget-show-in-template-toggle',
    );
    await expect(showInTemplateToggle).toBeVisible({ timeout: 6_000 });
    await expect(showInTemplateToggle).toHaveAttribute('aria-pressed', 'true');

    // Verify the budget config is visible (Currency select should appear)
    await expect(authenticatedPage.getByLabel('Currency')).toBeVisible({
      timeout: 6_000,
    });

    // 12. Verify the participant preview shows the budget field
    //     The preview renders an "Add budget" button when budget is enabled
    await expect(
      authenticatedPage.getByText('Participant Preview'),
    ).toBeVisible({ timeout: 6_000 });

    await expect(
      authenticatedPage.getByRole('button', { name: 'Add budget' }),
    ).toBeVisible({ timeout: 6_000 });

    // ── Final: Verify Launch Process button is enabled ──────────────────

    // 13. Verify the Launch Process button is enabled (not disabled)
    const launchButton = authenticatedPage.getByRole('button', {
      name: 'Launch Process',
    });
    await expect(launchButton).toBeVisible({ timeout: 18_000 });
    await expect(launchButton).toBeEnabled({ timeout: 18_000 });
  });
});
