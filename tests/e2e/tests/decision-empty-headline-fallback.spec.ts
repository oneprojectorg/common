import { createDecisionInstance, getSeededTemplate } from '@op/test';

import { expect, test } from '../fixtures/index.js';

/**
 * An admin clearing a phase's headline field (select-all, delete) persists it
 * as `''`, not `undefined` — the API explicitly supports this as a "reset to
 * the default copy" affordance. The current-phase hero title used `??` to
 * fall back to default copy, which only fires on `null`/`undefined`, so a
 * cleared headline rendered as a blank title instead of the intended default.
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
