import { expect, test, waitForAutoSave } from '../fixtures/index.js';

// Wider viewport so the participant preview panel (xl:block >= 1280px) is visible.
test.use({ viewport: { width: 1440, height: 900 } });

test.describe('Proposal template — location field', () => {
  // Regression guard: the sense migration dropped Location from the field
  // card's Type select, and there is no other route to it — location is
  // single-instance with a fixed key, so it is never "added", only switched
  // to from an existing field.
  test('a field can be switched to Location, and only one at a time', async ({
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

    // 3. Add two fields. Both land as Short text and auto-expand, so each has
    //    a Type select on screen.
    const addFieldButton = page.getByRole('button', { name: 'Add field' });
    await expect(addFieldButton).toBeVisible({ timeout: 6_000 });

    const firstFieldSaved = waitForAutoSave(page);
    await addFieldButton.click();
    await firstFieldSaved;

    const secondFieldSaved = waitForAutoSave(page);
    await addFieldButton.click();
    await secondFieldSaved;

    const typeSelects = page.getByLabel('Type');
    await expect(typeSelects).toHaveCount(2);

    // 4. Switch the first field to Location.
    const locationSaved = waitForAutoSave(page, 'location');
    await typeSelects.first().click();
    await page
      .getByRole('listbox')
      .getByRole('option', { name: 'Location' })
      .click();
    await locationSaved;

    // 5. The location config lands — its map-view picker is what proves the
    //    field is a real location field and not just a relabelled text one.
    //    (The card keeps its "Short text" name; retyping preserves the label
    //    the author can edit.)
    await expect(page.getByText('Map view')).toBeVisible({ timeout: 12_000 });

    // 6. The location card keeps the same header row as every other field —
    //    field name and type side by side. It used to drop its Type select
    //    entirely, which is what left Location unreachable in the first place.
    await expect(typeSelects).toHaveCount(2);
    await expect(typeSelects.first()).toContainText('Location');

    // 7. A template that collects a location always requires one, so the
    //    toggle is forced on and locked.
    const requiredToggles = page.getByRole('switch', { name: 'Required' });
    await expect(requiredToggles.first()).toBeChecked();
    await expect(requiredToggles.first()).toBeDisabled();

    // 8. Location is single-instance — a second one would overwrite the first
    //    at the shared fixed key, so the other field can no longer take it.
    await typeSelects.last().click();
    await expect(
      page.getByRole('listbox').getByRole('option', { name: 'Location' }),
    ).toBeDisabled({ timeout: 6_000 });
  });
});
