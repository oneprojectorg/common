import type {
  DecisionSchemaDefinition,
  RubricTemplateSchema,
} from '@op/common';
import {
  ProposalStatus,
  posts,
  postsToProfiles,
  processInstances,
} from '@op/db/schema';
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
 * Covers the reported gaps in user-content translation (ONE COWOP report:
 * "when viewing proposals, browsing all, viewing a proposal, and reviewing a
 * proposal against the rubric — none of the UGC is available. But I did see the
 * overview page translating").
 *
 * Two gaps are fixed and pinned here:
 * 1. The rubric review screen had no translate affordance at all. It now
 *    shares `useTranslateProposal` with the proposal page.
 * 2. Language detection sampled the body and skipped the title, so a proposal
 *    with a foreign title over a short body looked same-language.
 *
 * Each test asserts the presence of the Translate affordance only. No test
 * clicks Translate, so no test calls DeepL — reaching the affordance is what
 * the report is about.
 *
 * The Spanish samples below are long enough for franc (used by
 * `lib/languageDetection.ts`) to resolve a language. Short strings return
 * `und`, which the app reads as "no translation needed".
 */

const OVERVIEW_HEADLINE_ES = 'Presupuesto participativo para el barrio';
const OVERVIEW_DESCRIPTION_ES =
  'Este proceso permite que los vecinos decidan cómo se invierte el presupuesto municipal en mejoras para el barrio durante el próximo año. Cada propuesta recibe una revisión antes de la votación final.';

const OVERVIEW_HEADLINE_EN = 'Neighbourhood participatory budget';
const OVERVIEW_DESCRIPTION_EN =
  'This process lets neighbours decide how the city spends its budget on local improvements over the coming year. Every proposal is reviewed before the final vote.';

const POST_ES =
  'La fase de revisión comienza el lunes que viene. Los vecinos que quieran revisar propuestas deben inscribirse antes del viernes, y el equipo enviará las instrucciones por correo.';

const PROPOSAL_TITLE_EN = 'Community garden in the central park';
const PROPOSAL_BODY_EN =
  '<p>We propose building a community garden in the central park. The garden will offer fresh food to families and a meeting place for neighbours. We are asking for funds for tools, seeds and an irrigation system.</p>';

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
  test('both the overview and the rubric review screen offer translation', async ({
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

    // The overview has always offered the button. Assert it first so a
    // detection regression shows up here rather than on the review screen.
    await page.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByRole('heading', { name: OVERVIEW_HEADLINE_ES }).first(),
    ).toBeAttached({ timeout: 36_000 });
    await expect(
      page.getByRole('button', { name: TRANSLATE_BUTTON }),
    ).toBeVisible({ timeout: 36_000 });

    // The reviewer scoring the same Spanish proposal gets the same affordance.
    await page.goto(`/en/decisions/${instance.slug}/reviews/${assignment.id}`, {
      waitUntil: 'domcontentloaded',
    });
    // SplitPane hides the inactive pane with CSS, so the proposal title can
    // resolve to a hidden copy — anchor on the review chrome instead.
    await expect(
      page.getByRole('link', { name: 'Back to proposals' }),
    ).toBeVisible({ timeout: 36_000 });
    await expect(
      page.getByRole('heading', { name: PROPOSAL_TITLE_ES }).first(),
    ).toBeAttached();
    await expect(page.getByText('Proponemos construir').first()).toBeAttached();
    await expect(
      page.getByRole('button', { name: TRANSLATE_BUTTON }),
    ).toBeVisible({ timeout: 36_000 });

    await ctx.close();
  });

  test('a proposal with a Spanish title but no body offers translation', async ({
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

    // A Spanish body has always been detected.
    await page.goto(
      `/en/decisions/${instance.slug}/proposal/${withBody.profileId}`,
      { waitUntil: 'domcontentloaded' },
    );
    await expect(
      page.getByRole('button', { name: TRANSLATE_BUTTON }),
    ).toBeVisible({ timeout: 36_000 });

    // Subject: the title is the only Spanish text on the page. Detection now
    // samples it, so the reader can still translate.
    await page.goto(
      `/en/decisions/${instance.slug}/proposal/${titleOnly.profileId}`,
      { waitUntil: 'domcontentloaded' },
    );
    await expect(
      page.getByRole('heading', { name: PROPOSAL_TITLE_ES }).first(),
    ).toBeVisible({ timeout: 36_000 });
    await expect(
      page.getByRole('button', { name: TRANSLATE_BUTTON }),
    ).toBeVisible({ timeout: 36_000 });

    await ctx.close();
  });

  test('a Spanish update offers translation when the rest of the decision is English', async ({
    browser,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `translation-post-${testInfo.workerIndex}-${Date.now()}`;
    const template = await getSeededTemplate();

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: REVIEW_SCHEMA,
    });

    // Everything the reader can see is English EXCEPT the update. The overview
    // and the proposal are the only content detection samples today, so both
    // are deliberately English here.
    await db
      .update(processInstances)
      .set({
        instanceData: {
          ...(instance.instance.instanceData as Record<string, unknown>),
          overview: {
            headline: OVERVIEW_HEADLINE_EN,
            description: OVERVIEW_DESCRIPTION_EN,
          },
        },
        currentStateId: 'submission',
      })
      .where(eq(processInstances.id, instance.instance.id));

    const { user: author } = await createInstanceMember({
      supabaseAdmin,
      testId: `${testId}-author`,
      instanceProfileId: instance.profileId,
    });

    await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: author.profileId,
      authUserId: author.authUserId,
      email: author.email,
      status: ProposalStatus.SUBMITTED,
      proposalData: {
        title: PROPOSAL_TITLE_EN,
        description: PROPOSAL_BODY_EN,
      },
    });

    // A Spanish update on the decision's own profile — what the side panel
    // renders, and what `translatePosts` already knows how to translate.
    const [post] = await db
      .insert(posts)
      .values({ content: POST_ES, profileId: org.organizationProfile.id })
      .returning();
    if (!post) {
      throw new Error('Failed to seed the update post');
    }
    await db
      .insert(postsToProfiles)
      .values({ postId: post.id, profileId: instance.profileId });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await authenticateAsUser(page, {
      email: author.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await page.goto(`/en/decisions/${instance.slug}?panel=updates`, {
      waitUntil: 'domcontentloaded',
    });

    // The update renders, so the reader is looking at Spanish text.
    await expect(page.getByText('La fase de revisión').first()).toBeVisible({
      timeout: 36_000,
    });

    // The side panel is a modal, so it marks the page behind it aria-hidden and
    // the control is unreachable while the panel is open. Close it to read the
    // control the way a reader would.
    await page.getByRole('button', { name: 'Close' }).click();

    // `handleTranslate` already sends this decision's updates to
    // translatePosts, so the control has to be reachable for a reader whose
    // only unreadable content is an update.
    await expect(
      page.getByRole('button', { name: TRANSLATE_BUTTON }),
    ).toBeVisible({ timeout: 36_000 });

    await ctx.close();
  });
});
