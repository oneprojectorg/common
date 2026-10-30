import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { expect, test, waitForAutoSave } from '../fixtures/index.js';

// Use a wider viewport so the participant preview panel (xl:block >= 1280px) is visible.
test.use({ viewport: { width: 1440, height: 900 } });

test.describe('Create Process Instance', () => {
  test('can create a decision process and reach launch-ready state', async ({
    authenticatedPage,
  }) => {
    test.setTimeout(144_000);

    // 1. Navigate to the home page and trigger creation via the Create menu.
    //    The menu fires a client-side mutation that creates a draft instance
    //    from the seeded template and navigates to the editor.
    await authenticatedPage.goto('/en/');

    await authenticatedPage.getByRole('button', { name: 'Create' }).click();
    await authenticatedPage.getByTestId('create-decision-process').click();

    await authenticatedPage.waitForURL(/\/decisions\/[^/]+\/edit/, {
      timeout: 12_000,
    });

    // 2. Wait for the process builder editor to load
    await expect(
      authenticatedPage.getByRole('heading', { name: 'Process Settings' }),
    ).toBeVisible({
      timeout: 36_000,
    });

    // ── Step 1: General – Process Settings ──────────────────────────────

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

    const budgetSaved = waitForAutoSave(authenticatedPage);
    await authenticatedPage
      .getByLabel('Total budget', { exact: true })
      .fill('25000');
    await budgetSaved;
    await authenticatedPage.reload();
    await expect(
      authenticatedPage.getByLabel('Total budget', { exact: true }),
    ).toHaveValue('25000', { timeout: 18_000 });

    const hideBudget = authenticatedPage.getByRole('switch', {
      name: 'Hide the total budget from members',
    });
    const hideBudgetWasOn = await hideBudget.isChecked();
    const hideBudgetSaved = waitForAutoSave(authenticatedPage);
    await hideBudget.click();
    await hideBudgetSaved;
    await authenticatedPage.reload();
    await expect(
      authenticatedPage.getByRole('switch', {
        name: 'Hide the total budget from members',
      }),
    ).toBeChecked({ checked: !hideBudgetWasOn, timeout: 18_000 });

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
        'Arrange the stages of your decision process. Drag to reorder, click to configure.',
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

    const footer = authenticatedPage.getByRole('contentinfo');
    const nextButton = footer.getByRole('button', { name: 'Next' }).first();

    for (let i = 0; i < phaseCount; i++) {
      // Wait for the phase detail form to load
      const headlineField = authenticatedPage.getByLabel('Headline');
      await expect(headlineField).toBeVisible({ timeout: 6_000 });

      // Set up the auto-save listener before any field changes
      const phaseSaved = waitForAutoSave(authenticatedPage);

      // Fill phase name
      await authenticatedPage.getByLabel('Short name').fill(`Phase ${i + 1}`);

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

    // 8. Create one category
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

    // 9. Navigate to the Proposal Template step
    const templateButton = sidebarNav.getByRole('button', {
      name: 'Proposal Template',
    });
    await templateButton.click();

    await expect(
      authenticatedPage.getByText('Proposal template').first(),
    ).toBeVisible({ timeout: 12_000 });

    // 10b. Add a custom field so the template passes validation (requires at
    //       least 1 non-system field). "Add field" adds a short-text field
    //       directly (no type menu — change type via the card's Type select).
    const addFieldButton = authenticatedPage.getByRole('button', {
      name: 'Add field',
    });
    await expect(addFieldButton).toBeVisible({ timeout: 6_000 });
    // Arm the autosave wait before the click that triggers it.
    const templateFieldSaved = waitForAutoSave(authenticatedPage);
    await addFieldButton.click();
    await templateFieldSaved;

    // 10. Expand the Funding amount card — budget is enabled by default in the
    //     template. Match "Funding amount Optional/Required", the card header
    //     button.
    await authenticatedPage
      .getByRole('button', { name: /^Funding amount (Optional|Required)$/ })
      .click();

    // Verify the toggle is already ON
    const showInTemplateToggle = authenticatedPage.getByTestId(
      'budget-show-in-template-toggle',
    );
    await expect(showInTemplateToggle).toBeVisible({ timeout: 6_000 });
    // sense Switch exposes role="switch" + aria-checked (not aria-pressed).
    await expect(showInTemplateToggle).toBeChecked();

    // Verify the budget config is visible (Currency select should appear)
    await expect(authenticatedPage.getByLabel('Currency')).toBeVisible({
      timeout: 6_000,
    });

    // ── Final: Verify Launch Process button is enabled ──────────────────

    // 11. Verify the Launch Process button is enabled (not disabled)
    const launchButton = authenticatedPage.getByRole('button', {
      name: 'Launch Process',
    });
    await expect(launchButton).toBeVisible({ timeout: 18_000 });
    await expect(launchButton).toBeEnabled({ timeout: 18_000 });
  });
});

// The wizard's screens share one URL, so the route baseline only scans the intro.
test.describe('Create process wizard', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // The intro backdrop animates; reduced motion keeps axe's contrast reads stable.
    await authenticatedPage.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('creates a grant process, resuming after a reload, with no axe violations', async ({
    authenticatedPage: page,
  }) => {
    test.setTimeout(90_000);

    await page.goto('/en/decisions/new');
    await expectScreen(page, 'Set up your process on Common');
    await page.getByRole('button', { name: 'Get started' }).click();

    await expectScreen(page, 'What kind of process are you running?');
    await choose(page, 'Participatory grantmaking');

    await expectScreen(page, 'How do applications come in?');
    await choose(page, 'One full application');

    await expectScreen(page, 'Who decides what gets funded?');
    await choose(page, 'Reviewers score against a rubric');

    await expectScreen(page, "Here's how your process could run on Common");
    await page.getByRole('button', { name: 'Continue' }).click();

    await expectScreen(page, 'What should we call your process?');
    await page.reload();
    await expectScreen(page, 'What should we call your process?', {
      scan: false,
    });

    await page.getByLabel('Process name').fill('E2E Wizard Process');
    await page.getByRole('button', { name: 'Set up my process' }).click();

    await page.waitForURL(/\/decisions\/[^/]+\/edit/, { timeout: 12_000 });
    await expect(
      page.getByRole('heading', { name: 'Process Settings' }),
    ).toBeVisible({ timeout: 36_000 });

    // The draft opens with the name typed and the single-application phases.
    await expect(page.getByLabel('Process Name')).toHaveValue(
      'E2E Wizard Process',
    );
    const sidebarNav = page.getByRole('navigation', {
      name: 'Section navigation',
    });
    for (const phase of [
      'Send in your application',
      'Review and decide',
      'See the awards',
    ]) {
      await expect(sidebarNav.getByRole('button', { name: phase })).toBeVisible(
        { timeout: 18_000 },
      );
    }
  });

  test('walks the other-process questions with no axe violations', async ({
    authenticatedPage: page,
  }) => {
    test.setTimeout(90_000);

    await page.goto('/en/decisions/new');
    await page.getByRole('button', { name: 'Get started' }).click();
    await expectScreen(page, 'What kind of process are you running?', {
      scan: false,
    });
    await choose(page, 'Other process type');

    await expectScreen(page, 'What are you deciding?', { scan: false });
    await page.getByRole('radio', { name: /^Something else/ }).click();
    await page.getByLabel('What are you deciding on?').fill('A venue');
    await expectNoAxeViolations(page);
    await page.getByRole('button', { name: 'Continue' }).click();

    await expectScreen(
      page,
      'Does this process have an end, or is it always open?',
    );
    await choose(page, 'It has a timeline');

    await expectScreen(page, 'What do people put forward first?');
    await choose(page, 'Written submissions');

    await expectScreen(page, 'How does the decision get made?');
    await choose(page, 'Everyone votes');

    await expectScreen(page, "Here's how your process could run on Common", {
      scan: false,
    });
  });
});

/** Waits for a screen by its heading, then scans it unless another test already does. */
async function expectScreen(
  page: Page,
  heading: string,
  { scan = true }: { scan?: boolean } = {},
) {
  await expect(
    page.getByRole('heading', { level: 1, name: heading }),
  ).toBeVisible({ timeout: 12_000 });

  if (scan) {
    await expectNoAxeViolations(page);
  }
}

/** Picks a radio option on the current screen, then continues. */
async function choose(page: Page, label: string) {
  await page
    .getByRole('radio', { name: new RegExp(`^${escapeRegExp(label)}`) })
    .click();
  await page.getByRole('button', { name: 'Continue' }).click();
}

async function expectNoAxeViolations(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(
    violations.map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
    ),
  ).toEqual([]);
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
