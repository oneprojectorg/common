import { createDecisionInstance, getSeededTemplate } from '@op/test';

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
