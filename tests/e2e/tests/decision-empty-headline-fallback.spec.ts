import { ProcessStatus } from '@op/db/schema';
import {
  createDecisionInstance,
  getDecisionInstance,
  getSeededTemplate,
} from '@op/test';

import { expect, test } from '../fixtures/index.js';

/**
 * An admin clearing a phase's headline field (select-all, delete) used to
 * persist `''`, which the hero title's `??` fallback treated as content and
 * rendered as a blank `<h1>`. The API now rejects an empty title outright, and
 * decodes a stored one as absent — so a row written before that (seeded here
 * straight into `instanceData`) renders the default copy too.
 */
test('current-phase hero falls back to default copy when the phase headline is cleared to an empty string', async ({
  authenticatedPage,
  org,
}) => {
  const template = await getSeededTemplate();

  // createDecisionInstance opens on the first phase, so that's the one whose
  // headline has to be cleared for the current-phase hero to render it.
  const currentPhaseId = template.processSchema.phases[0].id;

  const instance = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema: template.processSchema,
    phaseHeadlines: { [currentPhaseId]: '' },
  });

  await authenticatedPage.goto(`/en/decisions/${instance.slug}/current`, {
    waitUntil: 'domcontentloaded',
  });

  // The default copy ("Share your ideas.") must show, not a blank title.
  await expect(
    authenticatedPage.getByRole('heading', {
      name: 'Share your ideas.',
      level: 1,
    }),
  ).toBeVisible({ timeout: 15000 });
});

/**
 * The other half of the contract: `''` is rejected by the endpoint, so the
 * process builder has to send the explicit clear (`null`) when an admin empties
 * the field. It autosaves per keystroke, so a payload it can't send would toast
 * a save error on every one — and the headline would never actually clear.
 */
test('clearing the overview headline in the builder saves as an explicit clear', async ({
  authenticatedPage,
  org,
}) => {
  const template = await getSeededTemplate();

  // Draft, so the builder autosaves (a published process saves via
  // "Update Process" instead).
  const instance = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema: template.processSchema,
    status: ProcessStatus.DRAFT,
  });

  const storedHeadline = async () => {
    const stored = await getDecisionInstance(instance.instance.id);
    return (stored.instanceData as { overview?: { headline?: string } })
      ?.overview?.headline;
  };

  await authenticatedPage.goto(`/en/decisions/${instance.slug}/edit`);

  await authenticatedPage
    .getByRole('navigation', { name: 'Section navigation' })
    .getByRole('button', { name: 'Overview' })
    .click();

  const headlineField = authenticatedPage.getByPlaceholder('Add a headline');
  await expect(headlineField).toBeVisible({ timeout: 18_000 });

  await headlineField.fill('Decide together');
  await expect(async () => {
    expect(await storedHeadline()).toBe('Decide together');
  }).toPass({ timeout: 20_000 });

  // Emptying the field must still save — as `null`, not `''`, which the
  // endpoint rejects. The autosave request carries the explicit clear...
  const cleared = authenticatedPage.waitForResponse(
    (response) =>
      response.url().includes('decision.updateDecisionInstance') &&
      response.ok() &&
      (response.request().postData()?.includes('"headline":null') ?? false),
    { timeout: 20_000 },
  );
  await headlineField.fill('');
  await cleared;

  // ...and the stored headline goes away rather than becoming `''`.
  await expect(async () => {
    expect(await storedHeadline()).toBeUndefined();
  }).toPass({ timeout: 20_000 });

  await expect(
    authenticatedPage.getByText('Failed to save changes'),
  ).toBeHidden();

  // The public overview falls back to the process name once the headline is gone.
  await authenticatedPage.goto(`/en/decisions/${instance.slug}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(
    authenticatedPage.getByRole('heading', { name: instance.name, level: 1 }),
  ).toBeVisible({ timeout: 15000 });
});
