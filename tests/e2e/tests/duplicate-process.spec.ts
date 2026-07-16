import { expect, test } from '../fixtures/index.js';

// Wider viewport so the decisions list actions column is fully visible.
test.use({ viewport: { width: 1440, height: 900 } });

test.describe('Duplicate Process', () => {
  // Regression: duplicating a process reported success but the duplicate never
  // appeared in the user's process list. The drafts list scoped by owner (always
  // the individual) instead of steward (the profile the user is acting as), so a
  // duplicate made while acting as an organization was invisible.
  test('duplicated process appears in the drafts list', async ({
    authenticatedPage,
  }) => {
    test.setTimeout(120_000);

    // 1. Create a draft process via the Create menu (navigates to the editor).
    await authenticatedPage.goto('/en/');
    await authenticatedPage.getByRole('button', { name: 'Create' }).click();
    await authenticatedPage
      .getByRole('menuitem', { name: 'Decision-making process' })
      .click();
    await authenticatedPage.waitForURL(/\/decisions\/[^/]+\/edit/, {
      timeout: 12_000,
    });
    await expect(
      authenticatedPage.getByRole('heading', { name: 'Process Settings' }),
    ).toBeVisible({ timeout: 36_000 });

    // 2. Go to the decisions drafts list — the freshly created draft is shown
    //    there because the list is scoped to the acting profile as steward.
    await authenticatedPage.goto('/en/decisions?tab=drafts');
    const draftsTab = authenticatedPage.getByRole('tab', {
      name: 'Your drafts',
    });
    await expect(draftsTab).toBeVisible({ timeout: 18_000 });
    await draftsTab.click();

    // 3. Open the option menu on the first draft and choose Duplicate.
    await authenticatedPage
      .getByRole('button', { name: 'Decision options' })
      .first()
      .click();
    await authenticatedPage
      .getByRole('menuitem', { name: 'Duplicate' })
      .click();

    // 4. Give the duplicate a unique name and submit. The steward defaults to
    //    the profile the user is acting as, so it lands in this same list.
    const duplicateName = `Duplicated Process ${Date.now()}`;
    await expect(
      authenticatedPage.getByRole('heading', { name: 'Duplicate process' }),
    ).toBeVisible({ timeout: 12_000 });
    await authenticatedPage.getByLabel('Process Name').fill(duplicateName);
    await authenticatedPage
      .getByRole('button', { name: 'Duplicate process' })
      .click();

    // 5. The duplicate must be visible in the drafts list.
    await expect(
      authenticatedPage.getByText(duplicateName, { exact: true }),
    ).toBeVisible({ timeout: 18_000 });
  });
});
