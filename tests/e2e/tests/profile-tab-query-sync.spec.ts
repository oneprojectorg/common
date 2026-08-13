import { expect, test } from '../fixtures/index.js';

/**
 * `ProfileTabsWithQuery` keeps the selected profile tab in sync with the `?tab=`
 * URL param: it reads the param on load, writes it via `history.replaceState`
 * when a tab is clicked, and drops the param for the default tab.
 *
 * Regression guard for the Tabs swap to @op/sense (the old react-aria shell used
 * `selectedKey`/`onSelectionChange(Key)` → base-ui `value`/`onValueChange(string)`).
 * If the controlled-value wiring is off, deep-links and URL updates break
 * silently — typecheck won't catch it.
 *
 * Desktop org tabs: "Updates" (value `home`, the default), "Relationships",
 * "Followers". Mobile renders a different tab set/labels, so pin a desktop
 * viewport.
 */
test.describe('Profile tab ?tab= query sync', () => {
  test('deep-links to a tab, updates the URL on switch, clears the param on default', async ({
    authenticatedPage,
    org,
  }) => {
    const slug = org.organizationProfile.slug;
    await authenticatedPage.setViewportSize({ width: 1280, height: 800 });

    // Deep-link to a non-default tab → selected on load. `exact` avoids the
    // inner relationships tablist ("All relationships" etc.) which also matches
    // "Relationships" as a substring.
    await authenticatedPage.goto(`/en/org/${slug}?tab=relationships`);
    await expect(
      authenticatedPage.getByRole('tab', {
        name: 'Relationships',
        exact: true,
      }),
    ).toHaveAttribute('aria-selected', 'true', { timeout: 15000 });

    // Switch to another non-default tab → URL reflects it (replaceState).
    await authenticatedPage
      .getByRole('tab', { name: 'Followers', exact: true })
      .click();
    await expect(authenticatedPage).toHaveURL(/[?&]tab=followers\b/);
    await expect(
      authenticatedPage.getByRole('tab', { name: 'Followers', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');

    // Back to the default tab ("Updates" = `home`) → the param is removed.
    await authenticatedPage
      .getByRole('tab', { name: 'Updates', exact: true })
      .click();
    await expect(authenticatedPage).not.toHaveURL(/[?&]tab=/);
    await expect(
      authenticatedPage.getByRole('tab', { name: 'Updates', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
  });
});
