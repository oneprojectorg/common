import { expect, test, waitForAutoSave } from '../fixtures/index.js';

// Wider viewport so the participant preview panel (xl:block >= 1280px) is visible.
test.use({ viewport: { width: 1440, height: 900 } });

test.describe('Proposal template — multi-select category', () => {
  // Regression guard for the multi-select category fix:
  //   - getFieldOptions now reads options off array-typed (multi-select) dropdowns
  //   - validateTemplateEditor skips locked fields (title/category)
  // Before the fix, a multi-select category resolved to zero options, tripped the
  // "needs 2+ options" dropdown check, and lit the Proposal Template section's
  // incomplete dot — an error the user could not fix from the editor.
  test('multi-select category does not flag the Proposal Template section as incomplete', async ({
    authenticatedPage: page,
  }) => {
    test.setTimeout(144_000);

    // 1. Create a draft process from the seeded template.
    await page.goto('/en/');
    await page.getByRole('button', { name: 'Create' }).click();
    await page
      .getByRole('menuitem', { name: 'Decision-making process' })
      .click();
    await page.waitForURL(/\/decisions\/[^/]+\/edit/, { timeout: 12_000 });
    await expect(
      page.getByRole('heading', { name: 'Process Settings' }),
    ).toBeVisible({
      timeout: 36_000,
    });

    const sidebarNav = page.getByRole('navigation', {
      name: 'Section navigation',
    });

    // 2. Jump straight to Proposal Categories.
    await sidebarNav
      .getByRole('button', { name: 'Proposal Categories' })
      .click();
    await expect(page.getByText('Proposal Categories').first()).toBeVisible({
      timeout: 12_000,
    });

    // 3. Add two categories.
    await page.getByRole('button', { name: 'Create first category' }).click();
    await page.getByLabel('Shorthand').fill('Education');
    let saved = waitForAutoSave(page);
    await page.getByRole('button', { name: 'Add category' }).click();
    await expect(page.getByText('Education', { exact: true })).toBeVisible();
    await saved;

    await page.getByRole('button', { name: 'Add category' }).click();
    await page.getByLabel('Shorthand').fill('Health');
    saved = waitForAutoSave(page);
    await page.getByRole('button', { name: 'Add category' }).click();
    await expect(page.getByText('Health', { exact: true })).toBeVisible();
    await saved;

    // 4. Enable "Allow multiple categories" (ToggleRow labels the switch, so
    //    target it by role + accessible name).
    const multiToggle = page.getByRole('switch', {
      name: 'Allow multiple categories',
    });
    const multiSaved = waitForAutoSave(page, 'allowMultipleCategories');
    await multiToggle.click();
    await multiSaved;
    // sense Switch exposes role="switch" + aria-checked (not aria-pressed).
    await expect(multiToggle).toBeChecked();

    // 5. Open the Proposal Template editor and make one edit so the normalized
    //    template (now carrying the multi-select category) is persisted — the
    //    section validator reads the persisted template, not editor-local state.
    await sidebarNav.getByRole('button', { name: 'Proposal Template' }).click();
    await expect(page.getByText('Proposal template').first()).toBeVisible({
      timeout: 12_000,
    });

    const addFieldButton = page.getByRole('button', { name: 'Add field' });
    await expect(addFieldButton).toBeVisible({ timeout: 6_000 });
    // "Add field" adds a short-text field directly (no type menu).
    const fieldSaved = waitForAutoSave(page);
    await addFieldButton.click();
    await fieldSaved;

    // 6. Positive control: Process Settings was left blank (no name/description
    //    entered), so its section MUST show the incomplete dot. This proves the
    //    selector matches real indicators, so the assertion below is meaningful
    //    rather than a never-matching selector.
    // Sidebar nav item is labeled "General Information" (page heading is still
    // "Process Settings"). Left blank, so its section shows the incomplete dot.
    const settingsNav = sidebarNav.getByRole('button', {
      name: 'General Information',
    });
    await expect(settingsNav.getByTestId('section-incomplete-dot')).toHaveCount(
      1,
    );

    // 7. The Proposal Template section must NOT show the incomplete dot.
    const templateNav = sidebarNav.getByRole('button', {
      name: 'Proposal Template',
    });
    await expect(templateNav.getByTestId('section-incomplete-dot')).toHaveCount(
      0,
    );
  });
});
