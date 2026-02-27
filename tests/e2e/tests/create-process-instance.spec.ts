import { expect, test } from '../fixtures/index.js';

// Use a wider viewport so the participant preview panel (xl:block >= 1280px) is visible.
test.use({ viewport: { width: 1440, height: 900 } });

/** Resolves when the next updateDecisionInstance mutation succeeds. */
function waitForAutoSave(page: import('@playwright/test').Page) {
  return page.waitForResponse(
    (resp) =>
      resp.url().includes('decision.updateDecisionInstance') && resp.ok(),
    { timeout: 10000 },
  );
}

test.describe('Create Process Instance', () => {
  test('can create a decision process and reach launch-ready state', async ({
    authenticatedPage,
  }) => {
    // 1. Navigate to the decisions create page (server-side creates a draft
    //    instance from the seeded template and redirects to the editor)
    await authenticatedPage.goto('/en/decisions/create');

    // 2. Wait for the process builder editor to load
    await expect(authenticatedPage.getByText('Process Overview')).toBeVisible({
      timeout: 30000,
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
    await expect(stewardOption).toBeVisible({ timeout: 5000 });
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
    const phasesTab = authenticatedPage.getByRole('tab', { name: 'Phases' });
    await expect(phasesTab).toBeVisible({ timeout: 15000 });
    await phasesTab.click();

    await expect(
      authenticatedPage.getByText(
        'Define the phases of your decision-making process',
      ),
    ).toBeVisible({ timeout: 10000 });

    // 7. Fill each phase's required fields.
    //    The seeded template has phases rendered as collapsed accordions.
    //    We expand each one, fill headline/description/endDate, then move on.
    const now = new Date();
    const phaseAccordions = authenticatedPage.locator(
      '[class*="group/accordion-item"]',
    );
    const phaseCount = await phaseAccordions.count();

    for (let i = 0; i < phaseCount; i++) {
      const phase = phaseAccordions.nth(i);

      // Click the accordion trigger to expand (the chevron button)
      await phase.locator('button[slot="trigger"]').click();

      // Wait for the phase content to be visible
      const headlineField = phase.getByLabel('Headline');
      await expect(headlineField).toBeVisible({ timeout: 5000 });

      // Fill phase name
      await phase.getByLabel('Phase name').fill(`Phase ${i + 1}`);

      // Fill headline
      await headlineField.fill(`Phase ${i + 1} headline`);

      // Fill description
      await phase
        .getByLabel('Description')
        .fill(`Description for phase ${i + 1}`);

      // Set end date — consecutive months from now
      const endDate = new Date(now.getFullYear(), now.getMonth() + i + 1, 15);
      const formatted = [
        String(endDate.getMonth() + 1).padStart(2, '0'),
        String(endDate.getDate()).padStart(2, '0'),
        endDate.getFullYear(),
      ].join('/');

      const endDateInput = phase.getByLabel('End date');
      await endDateInput.fill(formatted);
      await endDateInput.press('Enter');
    }

    // Wait for the phases auto-save to complete
    const phasesSaved = waitForAutoSave(authenticatedPage);
    await phasesSaved;

    // ── Step 1: General – Proposal Categories ───────────────────────────

    // 8. Navigate to the Proposal Categories section
    const categoriesTab = authenticatedPage.getByRole('tab', {
      name: 'Proposal Categories',
    });
    await expect(categoriesTab).toBeVisible({ timeout: 15000 });
    await categoriesTab.click();

    await expect(
      authenticatedPage.getByText('Proposal Categories').first(),
    ).toBeVisible({ timeout: 10000 });

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
    const templateTab = authenticatedPage.getByRole('tab', {
      name: 'Proposal Template',
    });
    await templateTab.click();

    await expect(
      authenticatedPage.getByText('Proposal template').first(),
    ).toBeVisible({ timeout: 10000 });

    // 11. Enable the Budget field in the template
    const templateSaved = waitForAutoSave(authenticatedPage);
    await authenticatedPage
      .getByRole('button', { name: 'Show in template?' })
      .click();

    // Verify the budget config expanded (Currency select should appear)
    await expect(authenticatedPage.getByLabel('Currency')).toBeVisible({
      timeout: 5000,
    });

    // 12. Verify the participant preview shows the budget field
    //     The preview renders an "Add budget" button when budget is enabled
    await expect(
      authenticatedPage.getByText('Participant Preview'),
    ).toBeVisible({ timeout: 5000 });

    await expect(
      authenticatedPage.getByRole('button', { name: 'Add budget' }),
    ).toBeVisible({ timeout: 5000 });

    await templateSaved;

    // ── Final: Verify Launch Process button is enabled ──────────────────

    // 13. Verify the Launch Process button is enabled (not disabled)
    const launchButton = authenticatedPage.getByRole('button', {
      name: 'Launch Process',
    });
    await expect(launchButton).toBeVisible({ timeout: 15000 });
    await expect(launchButton).toBeEnabled({ timeout: 15000 });
  });
});
