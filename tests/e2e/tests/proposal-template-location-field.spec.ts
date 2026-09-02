import { expect, test } from '../fixtures/index.js';

// Wider viewport so the participant preview panel (xl:block >= 1280px) is visible.
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

test.describe('Proposal template — location field', () => {
  // Regression guard: the sense migration replaced the categorized "Add field"
  // menu with a plain button that always added Short text, which left no UI
  // path to a location field at all — the field card's Type select excludes
  // location on purpose (single instance, fixed key), so the menu is the only
  // entry point.
  test('location can be added from the Add field menu, and only once', async ({
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
    ).toBeVisible({ timeout: 36_000 });

    // 2. Jump to the Proposal Template editor.
    await page
      .getByRole('navigation', { name: 'Section navigation' })
      .getByRole('button', { name: 'Proposal Template' })
      .click();
    await expect(page.getByText('Proposal template').first()).toBeVisible({
      timeout: 12_000,
    });

    // 3. The Add field menu offers Location alongside the text types.
    const addFieldButton = page.getByRole('button', { name: 'Add field' });
    await expect(addFieldButton).toBeVisible({ timeout: 6_000 });
    await addFieldButton.click();

    await expect(
      page.getByRole('menuitem', { name: 'Short text' }),
    ).toBeVisible();
    const locationItem = page.getByRole('menuitem', { name: 'Location' });
    await expect(locationItem).toBeVisible();
    await expect(locationItem).toBeEnabled();

    // 4. Adding it persists a location field.
    const fieldSaved = waitForAutoSave(page, 'location');
    await locationItem.click();
    await fieldSaved;

    // 5. The card renders as Required — the location toggle is forced on
    //    because the server projects the value onto a geometry column.
    await expect(
      page.getByRole('button', { name: /^Location Required$/ }),
    ).toBeVisible({ timeout: 6_000 });

    // 6. Location is single-instance: a second one would overwrite the first,
    //    so the menu entry is disabled once the template has one.
    await addFieldButton.click();
    await expect(page.getByRole('menuitem', { name: 'Location' })).toBeDisabled(
      { timeout: 6_000 },
    );
  });
});
