import { processInstances } from '@op/db/schema';
import { db, eq } from '@op/db/test';
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

  const instance = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema: template.processSchema,
  });

  const phases = (
    instance.instance.instanceData as { phases: { phaseId: string }[] }
  ).phases;

  // Simulate an admin clearing the current phase's headline field —
  // mirroring a select-all-and-delete in the process builder.
  await db
    .update(processInstances)
    .set({
      instanceData: {
        ...(instance.instance.instanceData as Record<string, unknown>),
        phases: phases.map((phase) =>
          phase.phaseId === instance.instance.currentStateId
            ? { ...phase, headline: '' }
            : phase,
        ),
      },
    })
    .where(eq(processInstances.id, instance.instance.id));

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
