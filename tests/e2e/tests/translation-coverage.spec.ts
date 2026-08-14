import type {
  DecisionSchemaDefinition,
  RubricTemplateSchema,
} from '@op/common';
import { ProposalStatus, processInstances } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import {
  createDecisionInstance,
  createInstanceMember,
  createProposal,
  createReviewScenario,
  getSeededTemplate,
  grantInstanceReviewerRole,
} from '@op/test';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  expect,
  test,
} from '../fixtures/index.js';

/**
 * Reproduces the reported gaps in user-content translation (ONE COWOP report:
 * "when viewing proposals, browsing all, viewing a proposal, and reviewing a
 * proposal against the rubric — none of the UGC is available. But I did see the
 * overview page translating").
 *
 * Each test asserts the presence or absence of the Translate affordance only.
 * No test clicks Translate, so no test calls DeepL — the affordance is the
 * thing under test, and gating it off is what the report describes.
 *
 * The Spanish samples below are long enough for franc (used by
 * `lib/languageDetection.ts`) to resolve a language. Short strings return
 * `und`, which the app reads as "no translation needed".
 */

const OVERVIEW_HEADLINE_ES = 'Presupuesto participativo para el barrio';
const OVERVIEW_DESCRIPTION_ES =
  'Este proceso permite que los vecinos decidan cómo se invierte el presupuesto municipal en mejoras para el barrio durante el próximo año. Cada propuesta recibe una revisión antes de la votación final.';

const PROPOSAL_TITLE_ES = 'Huerta comunitaria en el parque central del barrio';
const PROPOSAL_BODY_ES =
  '<p>Proponemos construir una huerta comunitaria en el parque central del barrio. La huerta ofrecerá alimentos frescos a las familias y será un espacio de encuentro para los vecinos. Solicitamos fondos para herramientas, semillas y un sistema de riego.</p>';

/** Matches the `Translate to {language}` label in `TranslateBanner`. */
const TRANSLATE_BUTTON = /Translate to/;

const REVIEW_SCHEMA = {
  id: 'translation-coverage-schema',
  version: '1.0.0',
  name: 'Translation Coverage Schema',
  description: 'Schema with a review-capable middle phase.',
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      description: 'Submit proposals',
      rules: {
        proposals: { submit: true },
        advancement: { method: 'manual' as const },
      },
    },
    {
      id: 'review',
      name: 'Review',
      description: 'Review proposals',
      rules: {
        proposals: { submit: false, review: true },
        advancement: { method: 'manual' as const },
      },
    },
  ],
} satisfies DecisionSchemaDefinition;

/** Minimal rubric so the review page does not `notFound()`. Never interacted with. */
const RUBRIC_TEMPLATE = {
  type: 'object',
  required: ['innovation'],
  'x-field-order': ['innovation'],
  properties: {
    innovation: {
      type: 'integer',
      title: 'Innovation',
      'x-format': 'dropdown',
      oneOf: [
        { const: 1, title: '1' },
        { const: 2, title: '2' },
      ],
    },
  },
} as const satisfies RubricTemplateSchema;

test.describe('UGC translation coverage', () => {
  test('the overview offers translation but the rubric review screen does not', async ({
    browser,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `translation-review-${testInfo.workerIndex}-${Date.now()}`;
    const template = await getSeededTemplate();

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: REVIEW_SCHEMA,
    });

    const seededData = instance.instance.instanceData as Record<
      string,
      unknown
    >;

    // Spanish overview copy — this is what the overview's detection samples.
    await db
      .update(processInstances)
      .set({
        instanceData: {
          ...seededData,
          rubricTemplate: RUBRIC_TEMPLATE,
          overview: {
            headline: OVERVIEW_HEADLINE_ES,
            description: OVERVIEW_DESCRIPTION_ES,
          },
        },
        currentStateId: 'review',
      })
      .where(eq(processInstances.id, instance.instance.id));

    const { user: author } = await createInstanceMember({
      supabaseAdmin,
      testId: `${testId}-author`,
      instanceProfileId: instance.profileId,
    });
    const { user: reviewer } = await createInstanceMember({
      supabaseAdmin,
      testId: `${testId}-reviewer`,
      instanceProfileId: instance.profileId,
    });

    await grantInstanceReviewerRole({
      instanceProfileId: instance.profileId,
      authUserId: reviewer.authUserId,
      email: reviewer.email,
      roleName: `Reviewer-${testId}`,
    });

    // A Spanish proposal, body included. `createProposal` skips the
    // collaboration doc when `description` is set, so the body is the legacy
    // HTML path and the e2e collab mock's English fixture never applies.
    const { assignment } = await createReviewScenario({
      instance: { id: instance.instance.id },
      author,
      reviewer: { profileId: reviewer.profileId },
      proposalData: {
        title: PROPOSAL_TITLE_ES,
        description: PROPOSAL_BODY_ES,
      },
    });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await authenticateAsUser(page, {
      email: reviewer.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    // Control: the overview owns both a provider and a trigger, so the button
    // appears. This proves the Spanish samples above are detected.
    await page.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByRole('heading', { name: OVERVIEW_HEADLINE_ES }).first(),
    ).toBeAttached({ timeout: 36_000 });
    await expect(
      page.getByRole('button', { name: TRANSLATE_BUTTON }),
    ).toBeVisible({ timeout: 36_000 });

    // The rubric review screen renders the same Spanish proposal, but sits
    // outside the `(decision-view)` route group — no provider, no trigger.
    await page.goto(`/en/decisions/${instance.slug}/reviews/${assignment.id}`, {
      waitUntil: 'domcontentloaded',
    });
    // ReviewLayout renders the proposal pane twice (desktop + mobile
    // containers), so anchor on the review chrome and assert the Spanish
    // proposal is on the page rather than fighting the duplicate panes.
    await expect(
      page.getByRole('link', { name: 'Back to proposals' }),
    ).toBeVisible({ timeout: 36_000 });
    await expect(
      page.getByRole('heading', { name: PROPOSAL_TITLE_ES }).first(),
    ).toBeAttached();
    await expect(page.getByText('Proponemos construir').first()).toBeAttached();
    await expect(
      page.getByRole('button', { name: TRANSLATE_BUTTON }),
    ).toHaveCount(0);

    await ctx.close();
  });

  test('a proposal with a Spanish title but no body offers no translation', async ({
    browser,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `translation-title-${testInfo.workerIndex}-${Date.now()}`;
    const template = await getSeededTemplate();

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: REVIEW_SCHEMA,
    });

    await db
      .update(processInstances)
      .set({ currentStateId: 'submission' })
      .where(eq(processInstances.id, instance.instance.id));

    const { user: author } = await createInstanceMember({
      supabaseAdmin,
      testId: `${testId}-author`,
      instanceProfileId: instance.profileId,
    });

    // Control — same Spanish title, plus a Spanish body.
    const withBody = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: author.profileId,
      authUserId: author.authUserId,
      email: author.email,
      status: ProposalStatus.SUBMITTED,
      proposalData: {
        title: PROPOSAL_TITLE_ES,
        description: PROPOSAL_BODY_ES,
      },
    });

    // Subject — Spanish title, no body. A collaboration doc id containing
    // "nonexistent" makes the e2e collab mock 404, so `documentContent` is
    // empty and `getProposalDetectionText` returns ''.
    const titleOnly = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: author.profileId,
      authUserId: author.authUserId,
      email: author.email,
      status: ProposalStatus.SUBMITTED,
      proposalData: {
        title: PROPOSAL_TITLE_ES,
        collaborationDocId: `nonexistent-${testId}`,
      },
    });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await authenticateAsUser(page, {
      email: author.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    // Control: a Spanish body is detected, so the detail page offers Translate.
    await page.goto(
      `/en/decisions/${instance.slug}/proposal/${withBody.profileId}`,
      { waitUntil: 'domcontentloaded' },
    );
    await expect(
      page.getByRole('button', { name: TRANSLATE_BUTTON }),
    ).toBeVisible({ timeout: 36_000 });

    // Subject: the title is Spanish and visible, but the detection sample
    // skips the title, so no Translate button renders.
    await page.goto(
      `/en/decisions/${instance.slug}/proposal/${titleOnly.profileId}`,
      { waitUntil: 'domcontentloaded' },
    );
    await expect(
      page.getByRole('heading', { name: PROPOSAL_TITLE_ES }).first(),
    ).toBeVisible({ timeout: 36_000 });
    await expect(
      page.getByRole('button', { name: TRANSLATE_BUTTON }),
    ).toHaveCount(0);

    await ctx.close();
  });
});
