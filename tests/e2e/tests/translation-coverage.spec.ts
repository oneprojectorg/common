import type {
  DecisionSchemaDefinition,
  RubricTemplateSchema,
} from '@op/common';
import {
  ProposalStatus,
  posts,
  postsToProfiles,
  processInstances,
  resourceCollectionItems,
  resourceCollectionProfiles,
  resourceCollections,
  resources,
} from '@op/db/schema';
import { db, eq } from '@op/db/test';
import {
  type CreateOrganizationResult,
  createDecisionInstance,
  createInstanceMember,
  createProposal,
  createReviewScenario,
  getSeededTemplate,
  grantInstanceReviewerRole,
} from '@op/test';
import type { BrowserContext, Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  expect,
  test as base,
} from '../fixtures/index.js';

/**
 * Covers the reported gaps in user-content translation (ONE COWOP report:
 * "when viewing proposals, browsing all, viewing a proposal, and reviewing a
 * proposal against the rubric — none of the UGC is available. But I did see the
 * overview page translating").
 *
 * Three gaps are fixed and pinned here:
 * 1. The rubric review screen had no translate affordance at all. It now
 *    mounts `ReviewTranslationProvider`, whose single banner moves the
 *    proposal pane and the rubric together.
 * 2. Language detection sampled the body and skipped the title, so a proposal
 *    with a foreign title over a short body looked same-language.
 * 3. Detection was computed by whichever component owned the control, from
 *    only the content that component rendered, so updates and resources were
 *    never sampled. `TranslationDetectionContext` now collects a sample from
 *    every surface on the screen.
 *
 * No test clicks Translate, so no test calls DeepL — reaching the affordance
 * is what the report is about. The click path (the mutation, the "Translated
 * from Spanish · View original" swap, and the failure toast) is therefore not
 * covered here.
 *
 * `no translation is offered when every surface is in the reader's language`
 * is the negative control for the whole file. Detection is a gate, so without
 * it every test here would still pass against a build that dropped the gate
 * and showed the control unconditionally.
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

const RESOURCE_TITLE_ES = 'Guía para preparar una propuesta vecinal';
const RESOURCE_DESCRIPTION_ES =
  'Este documento explica cómo preparar una propuesta para el presupuesto participativo del barrio, qué documentos hacen falta y cuáles son los plazos de entrega para cada fase del proceso.';

const RESOURCE_TITLE_EN = 'How to prepare a neighbourhood proposal';
const RESOURCE_DESCRIPTION_EN =
  'This document explains how to prepare a proposal for the neighbourhood participatory budget, which supporting documents are needed, and the deadlines that apply to each phase of the process.';

/** Matches the `Translate to {language}` label in `TranslateBanner`. */
const TRANSLATE_BUTTON = /Translate to/;

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
    await expect(
      page.getByRole('button', { name: TRANSLATE_BUTTON }),
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
    await expect(
      page.getByRole('button', { name: TRANSLATE_BUTTON }),
    ).toBeVisible();
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
      page.getByRole('button', { name: TRANSLATE_BUTTON }),
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
      page.getByRole('button', { name: TRANSLATE_BUTTON }),
    ).toBeVisible();
  });

  test('a Spanish update offers translation when the rest of the decision is English', async ({
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
    // renders, and what `translatePosts` already knows how to translate. The
    // post belongs to the worker-scoped org profile, so it is removed in
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

    // The side panel is a modal, so it marks the page behind it aria-hidden and
    // the control is unreachable while the panel is open. Close it to read the
    // control the way a reader would.
    await page.getByRole('button', { name: 'Close', exact: true }).click();

    // `handleTranslate` already sends this decision's updates to
    // translatePosts, so the control has to be reachable for a reader whose
    // only unreadable content is an update.
    await expect(
      page.getByRole('button', { name: TRANSLATE_BUTTON }),
    ).toBeVisible();
  });

  test('a Spanish resource offers translation when a later collection is English', async ({
    cleanup,
    org,
    signIn,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `translation-resource-${testInfo.workerIndex}-${Date.now()}`;

    // English everywhere except one resource, as above. Two collections is the
    // point: they render together in the open accordion, and each list used to
    // register its samples under one shared key, so the last collection
    // replaced every earlier one's samples.
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

    // Spanish first, English second — the order that failed. `sortKey` uses
    // the same fractional-index alphabet the service writes, so 'a0' sorts
    // ahead of 'a1' and the English collection registers last.
    await seedResourceCollection({
      cleanup,
      profileId: instance.profileId,
      addedByProfileId: author.profileId,
      name: `Guías ${testId}`,
      sortKey: 'a0',
      resource: {
        title: RESOURCE_TITLE_ES,
        description: RESOURCE_DESCRIPTION_ES,
      },
    });
    await seedResourceCollection({
      cleanup,
      profileId: instance.profileId,
      addedByProfileId: author.profileId,
      name: `Guides ${testId}`,
      sortKey: 'a1',
      resource: {
        title: RESOURCE_TITLE_EN,
        description: RESOURCE_DESCRIPTION_EN,
      },
    });

    const page = await signIn(author);

    await page.goto(`/en/decisions/${instance.slug}?panel=resources`, {
      waitUntil: 'domcontentloaded',
    });

    // Both collections are open, so both lists have registered their samples.
    await expect(page.getByText(RESOURCE_TITLE_ES).first()).toBeVisible({
      timeout: PAGE_READY_TIMEOUT,
    });
    await expect(page.getByText(RESOURCE_TITLE_EN).first()).toBeVisible();

    await page.getByRole('button', { name: 'Close', exact: true }).click();

    await expect(
      page.getByRole('button', { name: TRANSLATE_BUTTON }),
    ).toBeVisible();
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

    await page.goto(`/en/decisions/${instance.slug}`, {
      waitUntil: 'domcontentloaded',
    });

    // Wait for the content detection reads before asserting on its verdict —
    // the overview copy and the proposal card are the samples this screen
    // registers, so once both are on screen detection has had its input.
    await expect(
      page.getByRole('heading', { name: OVERVIEW_HEADLINE_EN }).first(),
    ).toBeVisible({ timeout: PAGE_READY_TIMEOUT });
    await expect(page.getByText(PROPOSAL_TITLE_EN).first()).toBeVisible();

    await expect(
      page.getByRole('button', { name: TRANSLATE_BUTTON }),
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
  rubricTemplate,
}: {
  org: CreateOrganizationResult;
  supabaseAdmin: SupabaseClient;
  testId: string;
  currentStateId: string;
  /** Left as the template seeded it when omitted. */
  overview?: { headline: string; description: string };
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

  await db
    .update(processInstances)
    .set({
      instanceData: {
        ...seededData,
        ...(rubricTemplate ? { rubricTemplate } : {}),
        ...(overview ? { overview } : {}),
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

/**
 * A resource collection on `profileId` holding one link resource. Removed in
 * teardown — collections hang off the decision profile, and a leftover one
 * would change what a later test on the same worker detects.
 */
async function seedResourceCollection({
  cleanup,
  profileId,
  addedByProfileId,
  name,
  sortKey,
  resource,
}: {
  cleanup: (remove: () => Promise<void>) => void;
  profileId: string;
  addedByProfileId: string;
  name: string;
  sortKey: string;
  resource: { title: string; description: string };
}) {
  const [collection] = await db
    .insert(resourceCollections)
    .values({ name, addedByProfileId })
    .returning();
  if (!collection) {
    throw new Error(`Failed to seed the resource collection "${name}"`);
  }
  // The junction rows cascade from the collection, so one delete covers them.
  cleanup(async () => {
    await db
      .delete(resourceCollections)
      .where(eq(resourceCollections.id, collection.id));
  });

  await db
    .insert(resourceCollectionProfiles)
    .values({ collectionId: collection.id, profileId, sortKey });

  // `type` is a generated column (link when there is no attachment), so the
  // insert supplies `linkUrl` and leaves the type to Postgres.
  const [record] = await db
    .insert(resources)
    .values({
      title: resource.title,
      description: resource.description,
      linkUrl: `https://example.test/${collection.id}`,
      addedByProfileId,
    })
    .returning();
  if (!record) {
    throw new Error(`Failed to seed the resource "${resource.title}"`);
  }
  cleanup(async () => {
    await db.delete(resources).where(eq(resources.id, record.id));
  });

  await db.insert(resourceCollectionItems).values({
    collectionId: collection.id,
    resourceId: record.id,
    sortKey: 'a0',
    addedByProfileId,
  });
}
