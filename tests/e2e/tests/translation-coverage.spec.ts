import type {
  DecisionSchemaDefinition,
  RubricTemplateSchema,
} from '@op/common';
import {
  type CreateOrganizationResult,
  createDecisionInstance,
  createInstanceMember,
  createProposal,
  createProposalReview,
  createReviewScenario,
  getSeededTemplate,
  grantInstanceReviewerRole,
} from '@op/common/testing/data';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
  ProposalReviewState,
  ProposalStatus,
  posts,
  postsToProfiles,
  processInstances,
} from '@op/db/schema';
import { db, eq } from '@op/db/test';
import type { BrowserContext, Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  expect,
  test as base,
} from '../fixtures/index.js';

/**
 * Covers the per-object "See translation" link (ONE COWOP report: "when
 * viewing proposals, browsing all, viewing a proposal, and reviewing a proposal
 * against the rubric — none of the UGC is available").
 *
 * Every authored object carries its own link — the process overview (above the
 * overview banner and the phase hero), a proposal (card, page, sheet, the
 * reviewer's proposal pane, the admin review summary) and an update — offered
 * only when that object's own text is in another language than the reader's.
 * There is no page-level translate control, and rubric text is configuration.
 *
 * DeepL is never called: the success path is unit-tested in the app, and the
 * card test fails the request on purpose to pin the inline failure state.
 *
 * `no translation is offered when every surface is already in English` is the
 * negative control for the whole file. Detection is a gate, so without it every
 * test here would still pass against a build that dropped the gate and showed
 * the link unconditionally.
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

const PHASE_HEADLINE_ES = 'Revisión de propuestas del barrio';
const PHASE_DESCRIPTION_ES =
  'En esta fase las personas revisoras leen cada propuesta y la puntúan con la rúbrica. Cada propuesta recibe al menos dos revisiones antes de pasar a la votación final del barrio.';

const POST_ES =
  'La fase de revisión comienza el lunes que viene. Los vecinos que quieran revisar propuestas deben inscribirse antes del viernes, y el equipo enviará las instrucciones por correo.';

const COMMENT_ES =
  'Me encanta esta propuesta. Los vecinos de la calle mayor llevamos años pidiendo un espacio verde donde los niños puedan jugar después de la escuela.';

const REVIEW_NOTE_ES =
  'La propuesta es clara y el presupuesto es razonable, pero falta explicar quién se encargará del mantenimiento de la huerta durante el invierno.';

const REVISION_REQUEST_ES =
  'Por favor, añade un calendario con las fechas de construcción y explica cómo participarán los vecinos en el cuidado de la huerta.';

const PROPOSAL_TITLE_EN = 'Community garden in the central park';
const PROPOSAL_BODY_EN =
  '<p>We propose building a community garden in the central park. The garden will offer fresh food to families and a meeting place for neighbours. We are asking for funds for tools, seeds and an irrigation system.</p>';

const PROPOSAL_TITLE_ES = 'Huerta comunitaria en el parque central del barrio';
const PROPOSAL_BODY_ES =
  '<p>Proponemos construir una huerta comunitaria en el parque central del barrio. La huerta ofrecerá alimentos frescos a las familias y será un espacio de encuentro para los vecinos. Solicitamos fondos para herramientas, semillas y un sistema de riego.</p>';

/**
 * Every authored object — the process overview, a proposal, a comment or
 * update, a review — carries its own "See translation" link, offered only when
 * that object's own text is in another language. There is no page-level
 * translate control.
 */
const SEE_TRANSLATION = 'See translation';

/**
 * Budget for the first assertion after a navigation — the e2e build compiles
 * pages on demand, so a cold route is slow. Bounded by the 60s per-test
 * timeout in `playwright.config.ts`, so it is a ceiling on one page load
 * rather than something every assertion can spend.
 */
const PAGE_READY_TIMEOUT = 36_000;

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

/**
 * `signIn` opens a context per user and closes them in teardown, which runs
 * even when a test fails — a bare `ctx.close()` at the end of a test does not.
 * `cleanup` collects rows to remove for the same reason: the `org` fixture is
 * worker-scoped, so anything written against the org's own profile outlives
 * the test that wrote it.
 */
const test = base.extend<{
  signIn: (user: { email: string }) => Promise<Page>;
  cleanup: (remove: () => Promise<void>) => void;
}>({
  signIn: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];

    await use(async (user) => {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      await authenticateAsUser(page, {
        email: user.email,
        password: TEST_USER_DEFAULT_PASSWORD,
      });

      return page;
    });

    for (const context of contexts) {
      await context.close();
    }
  },

  cleanup: async ({}, use) => {
    const tasks: Array<() => Promise<void>> = [];

    await use((remove) => {
      tasks.push(remove);
    });

    for (const remove of tasks.reverse()) {
      await remove();
    }
  },
});

test.describe('UGC translation coverage', () => {
  test('both the overview and the rubric review screen offer translation', async ({
    org,
    signIn,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `translation-review-${testInfo.workerIndex}-${Date.now()}`;

    // Spanish overview copy — this is what the overview's detection samples.
    const { instance, author } = await seedDecision({
      org,
      supabaseAdmin,
      testId,
      currentStateId: 'review',
      overview: {
        headline: OVERVIEW_HEADLINE_ES,
        description: OVERVIEW_DESCRIPTION_ES,
      },
      rubricTemplate: RUBRIC_TEMPLATE,
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

    const page = await signIn(reviewer);

    // The overview has always offered the button. Assert it first so a
    // detection regression shows up here rather than on the review screen.
    await page.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByRole('heading', { name: OVERVIEW_HEADLINE_ES }).first(),
    ).toBeVisible({ timeout: PAGE_READY_TIMEOUT });
    // The process's own link, above the overview banner.
    await expect(
      page.getByRole('button', { name: SEE_TRANSLATION }),
    ).toBeVisible();

    // The reviewer scoring the same Spanish proposal gets the same affordance.
    await page.goto(`/en/decisions/${instance.slug}/reviews/${assignment.id}`, {
      waitUntil: 'domcontentloaded',
    });
    // SplitPane hides the inactive pane with CSS, so the proposal title can
    // resolve to a hidden copy — anchor on the review chrome instead.
    await expect(
      page.getByRole('link', { name: 'Back to proposals' }),
    ).toBeVisible({ timeout: PAGE_READY_TIMEOUT });
    await expect(
      page.getByRole('heading', { name: PROPOSAL_TITLE_ES }).first(),
    ).toBeAttached();
    await expect(page.getByText('Proponemos construir').first()).toBeAttached();
    // The proposal pane carries the proposal's own link; the rubric is process
    // configuration and is not offered.
    await expect(
      page.getByRole('button', { name: SEE_TRANSLATION }).first(),
    ).toBeAttached();
  });

  test('a proposal with a Spanish title but no body offers translation', async ({
    org,
    signIn,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `translation-title-${testInfo.workerIndex}-${Date.now()}`;

    const { instance, author } = await seedDecision({
      org,
      supabaseAdmin,
      testId,
      currentStateId: 'submission',
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

    // Subject — Spanish title, no body. The e2e collab mock seeds four
    // specific doc ids and rejects every other one with a 404, so an id of our
    // own leaves `documentContent` empty and the body sample is ''.
    const titleOnly = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: author.profileId,
      authUserId: author.authUserId,
      email: author.email,
      status: ProposalStatus.SUBMITTED,
      proposalData: {
        title: PROPOSAL_TITLE_ES,
        collaborationDocId: `unseeded-${testId}`,
      },
    });

    const page = await signIn(author);

    // A Spanish body has always been detected.
    await page.goto(
      `/en/decisions/${instance.slug}/proposal/${withBody.profileId}`,
      { waitUntil: 'domcontentloaded' },
    );
    await expect(
      page.getByRole('button', { name: SEE_TRANSLATION }),
    ).toBeVisible({ timeout: PAGE_READY_TIMEOUT });

    // Subject: the title is the only Spanish text on the page. Detection now
    // samples it, so the reader can still translate.
    await page.goto(
      `/en/decisions/${instance.slug}/proposal/${titleOnly.profileId}`,
      { waitUntil: 'domcontentloaded' },
    );
    await expect(
      page.getByRole('heading', { name: PROPOSAL_TITLE_ES }).first(),
    ).toBeVisible({ timeout: PAGE_READY_TIMEOUT });
    await expect(
      page.getByRole('button', { name: SEE_TRANSLATION }),
    ).toBeVisible();
  });

  test('only the Spanish proposal card offers its own translation link', async ({
    org,
    signIn,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `translation-card-${testInfo.workerIndex}-${Date.now()}`;

    const { instance, author } = await seedDecision({
      org,
      supabaseAdmin,
      testId,
      currentStateId: 'submission',
      overview: {
        headline: OVERVIEW_HEADLINE_EN,
        description: OVERVIEW_DESCRIPTION_EN,
      },
    });

    // Each card detects its own language: the English card beside the
    // Spanish one is the negative control.
    for (const proposalData of [
      { title: PROPOSAL_TITLE_ES, description: PROPOSAL_BODY_ES },
      { title: PROPOSAL_TITLE_EN, description: PROPOSAL_BODY_EN },
    ]) {
      await createProposal({
        processInstanceId: instance.instance.id,
        submittedByProfileId: author.profileId,
        authUserId: author.authUserId,
        email: author.email,
        status: ProposalStatus.SUBMITTED,
        proposalData,
      });
    }

    const reader = await signIn(author);

    // Fail the request deterministically — no test calls DeepL. Aborting
    // doesn't depend on tRPC's batch or transformer format.
    await reader.route('**/*translation.translateProposals*', (route) =>
      route.abort(),
    );

    await reader.goto(`/en/decisions/${instance.slug}/current`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(reader.getByText(PROPOSAL_TITLE_EN).first()).toBeVisible({
      timeout: PAGE_READY_TIMEOUT,
    });
    await expect(reader.getByText(PROPOSAL_TITLE_ES).first()).toBeVisible();

    const seeTranslation = reader.getByRole('button', {
      name: SEE_TRANSLATION,
    });
    // Wait for detection to offer the link before counting, or the count
    // could read before a wrongly offered English link renders.
    await expect(seeTranslation.first()).toBeVisible();
    await expect(seeTranslation).toHaveCount(1);

    const urlBefore = reader.url();
    await seeTranslation.click();

    // The failure is inline, in the link's place, and the original stays.
    await expect(reader.getByText('Translation failed.')).toBeVisible();
    await expect(
      reader.getByRole('button', { name: 'Try again' }),
    ).toBeVisible();
    await expect(reader.getByText(PROPOSAL_TITLE_ES).first()).toBeVisible();
    // The link is an action, not navigation: the proposal didn't open.
    expect(reader.url()).toBe(urlBefore);

    // Opened, the proposal offers the same link above its title, starting
    // from the original.
    await reader
      .getByRole('link', { name: PROPOSAL_TITLE_ES, exact: true })
      .click();
    const sheet = reader.getByRole('dialog', { name: 'Proposal' });
    await expect(
      sheet.getByRole('button', { name: SEE_TRANSLATION }),
    ).toBeVisible({ timeout: PAGE_READY_TIMEOUT });
  });

  test('a Spanish update offers its own translation link', async ({
    cleanup,
    org,
    signIn,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `translation-post-${testInfo.workerIndex}-${Date.now()}`;

    // Everything the reader can see is English EXCEPT the update, so the
    // control can only appear because detection sampled the update.
    const { instance, author } = await seedDecision({
      org,
      supabaseAdmin,
      testId,
      currentStateId: 'submission',
      overview: {
        headline: OVERVIEW_HEADLINE_EN,
        description: OVERVIEW_DESCRIPTION_EN,
      },
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
    // renders, and what `translatePost` translates one at a time. The post
    // belongs to the worker-scoped org profile, so it is removed in
    // teardown rather than left on a profile later tests share.
    const [post] = await db
      .insert(posts)
      .values({ content: POST_ES, profileId: org.organizationProfile.id })
      .returning();
    if (!post) {
      throw new Error('Failed to seed the update post');
    }
    cleanup(async () => {
      await db.delete(posts).where(eq(posts.id, post.id));
    });
    await db
      .insert(postsToProfiles)
      .values({ postId: post.id, profileId: instance.profileId });

    const page = await signIn(author);

    await page.goto(`/en/decisions/${instance.slug}?panel=updates`, {
      waitUntil: 'domcontentloaded',
    });

    // The update renders, so the reader is looking at Spanish text.
    await expect(page.getByText('La fase de revisión').first()).toBeVisible({
      timeout: PAGE_READY_TIMEOUT,
    });

    // The update is its own authored object: its link sits under the author
    // row, inside the panel.
    const panel = page.getByRole('dialog', { name: 'Decision updates panel' });
    await expect(
      panel.getByRole('button', { name: SEE_TRANSLATION }),
    ).toBeVisible();
  });

  test('a Spanish proposal in the reviewer queue offers its own translation link', async ({
    org,
    signIn,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `translation-queue-${testInfo.workerIndex}-${Date.now()}`;

    const { instance, author } = await seedDecision({
      org,
      supabaseAdmin,
      testId,
      currentStateId: 'review',
      overview: {
        headline: OVERVIEW_HEADLINE_EN,
        description: OVERVIEW_DESCRIPTION_EN,
      },
      rubricTemplate: RUBRIC_TEMPLATE,
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

    await createReviewScenario({
      instance: { id: instance.instance.id },
      author,
      reviewer: { profileId: reviewer.profileId },
      proposalData: {
        title: PROPOSAL_TITLE_ES,
        description: PROPOSAL_BODY_ES,
      },
    });

    const page = await signIn(reviewer);

    await page.goto(`/en/decisions/${instance.slug}/current`, {
      waitUntil: 'domcontentloaded',
    });

    // Anchor on the queue so a routing change cannot pass this by rendering
    // some other phase's screen.
    await expect(
      page.getByRole('tab', { name: 'Proposals to review' }),
    ).toBeVisible({ timeout: PAGE_READY_TIMEOUT });

    await expect(
      page.getByRole('button', { name: SEE_TRANSLATION }),
    ).toBeVisible();
  });

  test('a Spanish review phase offers the process translation link', async ({
    org,
    signIn,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `translation-phase-${testInfo.workerIndex}-${Date.now()}`;

    // The phase hero is author-written and `translateDecision` already covers
    // it, but only the "Other proposals" list sampled it — and a review phase
    // does not mount that list. A reader whose proposals happen to be English
    // could not translate the phase copy in front of them.
    const { instance, author } = await seedDecision({
      org,
      supabaseAdmin,
      testId,
      currentStateId: 'review',
      overview: {
        headline: OVERVIEW_HEADLINE_EN,
        description: OVERVIEW_DESCRIPTION_EN,
      },
      phaseCopy: {
        phaseId: 'review',
        headline: PHASE_HEADLINE_ES,
        description: PHASE_DESCRIPTION_ES,
      },
      rubricTemplate: RUBRIC_TEMPLATE,
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

    await createReviewScenario({
      instance: { id: instance.instance.id },
      author,
      reviewer: { profileId: reviewer.profileId },
      proposalData: {
        title: PROPOSAL_TITLE_EN,
        description: PROPOSAL_BODY_EN,
      },
    });

    const page = await signIn(reviewer);

    await page.goto(`/en/decisions/${instance.slug}/current`, {
      waitUntil: 'domcontentloaded',
    });

    // The Spanish phase copy is on screen, so the reader is looking at text
    // they may not be able to read.
    await expect(
      page.getByRole('heading', { name: PHASE_HEADLINE_ES }).first(),
    ).toBeVisible({ timeout: PAGE_READY_TIMEOUT });

    // The process's link, above the phase hero.
    await expect(
      page.getByRole('button', { name: SEE_TRANSLATION }),
    ).toBeVisible();
  });

  test('the admin review summary offers translation for a Spanish proposal', async ({
    org,
    signIn,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `translation-summary-${testInfo.workerIndex}-${Date.now()}`;

    // `/proposal/<id>/reviews` serves two different screens: a reviewer gets
    // the review form, an admin gets this summary. Only the reviewer's branch
    // was ever wired for translation, so an admin reading a Spanish proposal
    // had no control at all.
    const { instance, author } = await seedDecision({
      org,
      supabaseAdmin,
      testId,
      currentStateId: 'review',
      overview: {
        headline: OVERVIEW_HEADLINE_EN,
        description: OVERVIEW_DESCRIPTION_EN,
      },
      rubricTemplate: RUBRIC_TEMPLATE,
    });

    const proposal = await createProposal({
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

    // The org admin owns the decision, so this URL resolves to the summary.
    const page = await signIn(org.adminUser);

    await page.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}/reviews`,
      { waitUntil: 'domcontentloaded' },
    );

    // Anchor on the summary so the reviewer branch cannot satisfy this test.
    // SplitPane hides the inactive pane with CSS, so both of these resolve to
    // a hidden copy — assert presence, as the review-screen test does.
    await expect(
      page.getByText(/Review (Progress|Summary)/).first(),
    ).toBeAttached({ timeout: PAGE_READY_TIMEOUT });
    await expect(
      page.getByRole('heading', { name: PROPOSAL_TITLE_ES }).first(),
    ).toBeAttached();

    await expect(
      page.getByRole('button', { name: SEE_TRANSLATION }),
    ).toBeVisible();
  });

  test('a Spanish comment offers its own translation link', async ({
    cleanup,
    org,
    signIn,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `translation-comment-${testInfo.workerIndex}-${Date.now()}`;

    const { instance, author } = await seedDecision({
      org,
      supabaseAdmin,
      testId,
      currentStateId: 'submission',
    });

    // An English proposal, so the only foreign text is the comment under it.
    const proposal = await createProposal({
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

    const [comment] = await db
      .insert(posts)
      .values({ content: COMMENT_ES, profileId: author.profileId })
      .returning();
    if (!comment) {
      throw new Error('Failed to seed the comment');
    }
    cleanup(async () => {
      await db.delete(posts).where(eq(posts.id, comment.id));
    });
    await db
      .insert(postsToProfiles)
      .values({ postId: comment.id, profileId: proposal.profileId });

    const page = await signIn(author);

    await page.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}`,
      { waitUntil: 'domcontentloaded' },
    );
    await expect(page.getByText('Me encanta esta propuesta')).toBeVisible({
      timeout: PAGE_READY_TIMEOUT,
    });

    // One link on the page: the comment's. The English proposal offers none.
    await expect(
      page.getByRole('button', { name: SEE_TRANSLATION }),
    ).toHaveCount(1);
    await expect(
      page.getByRole('feed').getByRole('button', { name: SEE_TRANSLATION }),
    ).toBeVisible();
  });

  test('a submitted review in Spanish offers its own translation link', async ({
    org,
    signIn,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `translation-review-note-${testInfo.workerIndex}-${Date.now()}`;

    const { instance, author } = await seedDecision({
      org,
      supabaseAdmin,
      testId,
      currentStateId: 'review',
      rubricTemplate: RUBRIC_TEMPLATE,
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

    // English proposal, Spanish review: only the review's link should show.
    const { proposal, assignment, assignedProposalHistoryId } =
      await createReviewScenario({
        instance: { id: instance.instance.id },
        author,
        reviewer: { profileId: reviewer.profileId },
        proposalData: {
          title: PROPOSAL_TITLE_EN,
          description: PROPOSAL_BODY_EN,
        },
        assignmentStatus: ProposalReviewAssignmentStatus.COMPLETED,
      });
    await createProposalReview({
      assignmentId: assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: {
        answers: { innovation: 2 },
        rationales: { innovation: REVIEW_NOTE_ES },
      },
      overallComment: REVIEW_NOTE_ES,
      submittedAt: new Date().toISOString(),
      reviewedProposalHistoryId: assignedProposalHistoryId,
    });

    // The org admin owns the decision, so this URL resolves to the summary;
    // the deep link opens the review itself.
    const page = await signIn(org.adminUser);
    await page.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}/reviews?assignment=${assignment.id}`,
      { waitUntil: 'domcontentloaded' },
    );
    await expect(page.getByText('La propuesta es clara').first()).toBeVisible({
      timeout: PAGE_READY_TIMEOUT,
    });

    await expect(
      page.getByRole('button', { name: SEE_TRANSLATION }),
    ).toHaveCount(1);
  });

  test('a Spanish revision request offers its own translation link', async ({
    org,
    signIn,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `translation-request-${testInfo.workerIndex}-${Date.now()}`;

    const { instance, author } = await seedDecision({
      org,
      supabaseAdmin,
      testId,
      currentStateId: 'review',
      rubricTemplate: RUBRIC_TEMPLATE,
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

    const { proposal } = await createReviewScenario({
      instance: { id: instance.instance.id },
      author,
      reviewer: { profileId: reviewer.profileId },
      proposalData: {
        title: PROPOSAL_TITLE_EN,
        description: PROPOSAL_BODY_EN,
      },
      assignmentStatus: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
      revisionRequest: {
        state: ProposalReviewRequestState.REQUESTED,
        requestComment: REVISION_REQUEST_ES,
      },
    });

    const page = await signIn(author);
    await page.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}`,
      { waitUntil: 'domcontentloaded' },
    );
    await page
      .getByRole('button', { name: 'Review notes' })
      .click({ timeout: PAGE_READY_TIMEOUT });
    await expect(
      page.getByText('Por favor, añade un calendario'),
    ).toBeVisible();

    // The English proposal offers nothing; the request offers its own link.
    await expect(
      page.getByRole('button', { name: SEE_TRANSLATION }),
    ).toHaveCount(1);
  });

  test('no translation is offered when every surface is already in English', async ({
    org,
    signIn,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `translation-none-${testInfo.workerIndex}-${Date.now()}`;

    // The negative control for the file. Detection is a gate, and every other
    // test asserts the control is present — so without this one, a build that
    // dropped the gate and always rendered the control would pass all of them.
    const { instance, author } = await seedDecision({
      org,
      supabaseAdmin,
      testId,
      currentStateId: 'submission',
      overview: {
        headline: OVERVIEW_HEADLINE_EN,
        description: OVERVIEW_DESCRIPTION_EN,
      },
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

    const page = await signIn(author);

    // The phase tab, not the overview: this is the screen that registers the
    // most samples (the proposals and the phase copy), so it is where a gate
    // that stopped gating would show up first.
    await page.goto(`/en/decisions/${instance.slug}/current`, {
      waitUntil: 'domcontentloaded',
    });

    // Wait for the content detection reads before asserting on its verdict —
    // once the proposal card is on screen, detection has had its input.
    await expect(page.getByText(PROPOSAL_TITLE_EN).first()).toBeVisible({
      timeout: PAGE_READY_TIMEOUT,
    });

    await expect(
      page.getByRole('button', { name: SEE_TRANSLATION }),
    ).toHaveCount(0);
  });
});

/**
 * A decision instance with one member, ready to read as that member. Every
 * test here needs the same instance, so only the parts that vary per test —
 * the phase, the overview copy, the rubric — are parameters.
 */
async function seedDecision({
  org,
  supabaseAdmin,
  testId,
  currentStateId,
  overview,
  phaseCopy,
  rubricTemplate,
}: {
  org: CreateOrganizationResult;
  supabaseAdmin: SupabaseClient;
  testId: string;
  currentStateId: string;
  /** Left as the template seeded it when omitted. */
  overview?: { headline: string; description: string };
  /** Author-written copy for one phase — what the phase hero renders. */
  phaseCopy?: { phaseId: string; headline: string; description: string };
  rubricTemplate?: RubricTemplateSchema;
}) {
  const template = await getSeededTemplate();

  const instance = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema: REVIEW_SCHEMA,
  });

  const seededData = instance.instance.instanceData as Record<string, unknown>;
  const seededPhases = (seededData.phases ?? []) as Array<
    Record<string, unknown>
  >;

  await db
    .update(processInstances)
    .set({
      instanceData: {
        ...seededData,
        ...(rubricTemplate ? { rubricTemplate } : {}),
        ...(overview ? { overview } : {}),
        ...(phaseCopy
          ? {
              phases: seededPhases.map((phase) =>
                phase.phaseId === phaseCopy.phaseId
                  ? {
                      ...phase,
                      headline: phaseCopy.headline,
                      description: phaseCopy.description,
                    }
                  : phase,
              ),
            }
          : {}),
      },
      currentStateId,
    })
    .where(eq(processInstances.id, instance.instance.id));

  const { user: author } = await createInstanceMember({
    supabaseAdmin,
    testId: `${testId}-author`,
    instanceProfileId: instance.profileId,
  });

  return { instance, author };
}
