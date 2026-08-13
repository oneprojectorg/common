import type {
  DecisionInstanceData,
  DecisionSchemaDefinition,
} from '@op/common';
import {
  ProcessStatus,
  ProposalStatus,
  processInstances,
  profiles,
  proposals as proposalsTable,
} from '@op/db/schema';
import { db, eq, inArray } from '@op/db/test';
import {
  addProposalToCategory,
  createCategoryReviewer,
  createDecisionInstance,
  createInstanceMember,
  createProposal,
  ensureProposalCategoryTerms,
  getSeededTemplate,
  grantInstanceReviewerRole,
} from '@op/test';
import type { Browser, Page } from '@playwright/test';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  expect,
  test,
} from '../fixtures/index.js';

/**
 * These tests exercise the *UI wiring* of reviews-by-category:
 *  1. the Process Builder Reviews step (scope radio + per-category reviewer
 *     cards), and
 *  2. the scoped reviewer queue + assigned-categories header, driven by the
 *     REAL generation-at-transition path (advance via the admin UI) and the
 *     REAL mid-phase reconcile (adding a reviewer via the builder card).
 *
 * Backend semantics — the scope⨝category⨝eligibility intersection, multi-category
 * dedupe, self-review exclusion, and the "0-reviewer / uncategorized proposals
 * warn but don't block" rule — are already covered by the integration suites
 * (generateReviewAssignmentsByCategory.test.ts, reconcileReviewAssignments.test.ts)
 * and are deliberately NOT re-tested here.
 */

const CATEGORY_LABELS = ['District 1', 'District 2', 'District 3'];

/**
 * Distinct, review-capable proposal titles. Each string is BOTH the seeded
 * `proposalData.title` AND the value the collab mock returns for its
 * `title` fragment (see @op/collab testing mock), so the card title assertion
 * holds regardless of which source resolves it.
 */
const PROPOSALS = [
  {
    title: 'Community Solar Initiative',
    collaborationDocId: 'test-proposal-view-doc',
    category: 'District 1',
  },
  {
    title: 'Community Garden Project',
    collaborationDocId: 'test-proposal-listing-doc',
    category: 'District 2',
  },
  {
    title: 'Youth Mentorship Program',
    collaborationDocId: 'test-proposal-listing-doc-alt',
    category: 'District 3',
  },
] as const;

/** Base three-phase schema. `reviewScope` is applied to the review phase. */
function reviewSchema(
  reviewScope: 'all' | 'by_category',
): DecisionSchemaDefinition {
  return {
    id: `review-by-category-${reviewScope}`,
    version: '1.0.0',
    name: 'Review By Category E2E',
    description: 'Schema with a by-category review phase for e2e tests.',
    proposalTemplate: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          title: 'Proposal title',
          'x-format': 'short-text',
        },
      },
      'x-field-order': ['title'],
      required: ['title'],
    },
    phases: [
      {
        id: 'submission',
        name: 'Submission',
        description: 'Members submit proposals.',
        rules: {
          proposals: { submit: true },
          voting: { submit: false },
          advancement: { method: 'manual' },
        },
        // Pass-all so submission→review carries every submitted proposal forward.
        selectionPipeline: { version: '1.0.0', blocks: [] },
      },
      {
        id: 'review',
        name: 'Review',
        description: 'Reviewers evaluate proposals.',
        rules: {
          proposals: { submit: false, review: true },
          voting: { submit: false },
          reviews: { submit: true, scope: reviewScope },
          advancement: { method: 'manual' },
        },
      },
      {
        id: 'results',
        name: 'Results',
        description: 'Final results.',
        rules: {
          proposals: { submit: false },
          voting: { submit: false },
          advancement: { method: 'manual' },
        },
      },
    ],
  } satisfies DecisionSchemaDefinition;
}

type SeedOrg = {
  organizationProfile: { id: string };
  adminUser: { authUserId: string; email: string };
};

/**
 * Writes `config.categories` onto an instance so `getProcessCategories` (and
 * therefore the builder cards + the queue header) resolve them. Each config
 * category label must match a real taxonomy term's slug — the terms are ensured
 * separately by `ensureProposalCategoryTerms`.
 */
async function setInstanceCategories(
  instanceId: string,
  instanceData: DecisionInstanceData,
  terms: Array<{ label: string; taxonomyTermId: string }>,
) {
  await db
    .update(processInstances)
    .set({
      instanceData: {
        ...instanceData,
        config: {
          ...instanceData.config,
          categories: terms.map((term) => ({
            id: term.taxonomyTermId,
            label: term.label,
            description: '',
          })),
        },
      },
    })
    .where(eq(processInstances.id, instanceId));
}

/** Creates an instance reviewer (REVIEW role) with a deterministic profile name. */
async function createNamedReviewer({
  supabaseAdmin,
  testId,
  instanceProfileId,
  name,
}: {
  supabaseAdmin: Parameters<typeof createInstanceMember>[0]['supabaseAdmin'];
  testId: string;
  instanceProfileId: string;
  name: string;
}) {
  const { user } = await createInstanceMember({
    supabaseAdmin,
    testId,
    instanceProfileId,
  });
  await grantInstanceReviewerRole({
    instanceProfileId,
    authUserId: user.authUserId,
    email: user.email,
    roleName: `${name}-${testId}`,
  });
  await db
    .update(profiles)
    .set({ name })
    .where(eq(profiles.id, user.profileId));
  return user;
}

/**
 * Opens the Process Builder "Reviews" step. Navigating straight to
 * `?section=reviewSettings` loses a hydration race (the nav resets an unknown
 * section to the first one before `hasReviewPhase` resolves), so instead land
 * on the builder and click the sidebar item once it's mounted.
 */
async function openReviewsBuilderStep(page: Page, slug: string) {
  await page.goto(`/en/decisions/${slug}/edit`, {
    waitUntil: 'domcontentloaded',
  });
  const reviewsNav = page.getByRole('button', { name: 'Reviews', exact: true });
  await expect(reviewsNav).toBeVisible({ timeout: 36_000 });

  // The nav renders before the builder store finishes hydrating, and a click
  // that lands in that window is dropped — leaving General Information up.
  // Retry until the Reviews pane is actually on screen.
  await expect(async () => {
    await reviewsNav.click();
    await expect(
      page.getByRole('heading', { name: 'Reviews', exact: true }),
    ).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 36_000 });
}

/** Locates a single category reviewer card by its category heading. */
function categoryCard(page: Page, label: string) {
  // The cards are plain nested divs, so a structural locator resolves to a
  // wrapper holding several of them (two "0 reviewers" cards, say). The card
  // carries a testid for exactly this reason.
  return page.getByTestId(`category-reviewer-card-${label}`);
}

/** Advances an instance from submission→review via the admin overview UI,
 * which triggers the real by-category assignment generation at transition. */
async function advanceToReviewViaUI(page: Page, slug: string) {
  await page.goto(`/en/decisions/${slug}`, { waitUntil: 'networkidle' });

  const advanceButton = page.getByRole('button', { name: 'Advance' }).first();
  await expect(advanceButton).toBeVisible({ timeout: 36_000 });

  const transition = page.waitForResponse(
    (response) =>
      response.url().includes('transitionFromPhase') &&
      response.request().method() === 'POST',
  );

  await advanceButton.click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Advance to Review?')).toBeVisible();
  await dialog.getByRole('button', { name: 'Advance Phase' }).click();

  // Generation runs (awaited) inside the transition mutation, so once the
  // response lands the assignment rows exist.
  await transition;
  await expect(dialog).not.toBeVisible({ timeout: 15_000 });
}

/**
 * Seeds a published, by-category review instance parked on the submission phase:
 * 3 categories, 3 submitted proposals (one per district), reviewer R1 scoped to
 * District 1, reviewer R2 scoped to Districts 1+2. District 3 has no reviewers.
 * The caller advances into review to run generation.
 */
async function seedByCategoryInstance(
  org: SeedOrg,
  supabaseAdmin: Parameters<typeof createInstanceMember>[0]['supabaseAdmin'],
  testId: string,
) {
  const template = await getSeededTemplate();
  const instance = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema: reviewSchema('by_category'),
  });

  const terms = await ensureProposalCategoryTerms([...CATEGORY_LABELS]);
  const termByLabel = new Map(terms.map((t) => [t.label, t.taxonomyTermId]));
  await setInstanceCategories(
    instance.instance.id,
    instance.instance.instanceData as DecisionInstanceData,
    terms,
  );

  const r1 = await createNamedReviewer({
    supabaseAdmin,
    testId: `${testId}-r1`,
    instanceProfileId: instance.profileId,
    name: 'Reviewer One',
  });
  const r2 = await createNamedReviewer({
    supabaseAdmin,
    testId: `${testId}-r2`,
    instanceProfileId: instance.profileId,
    name: 'Reviewer Two',
  });

  // Insert proposals as DRAFT then flip to SUBMITTED so the proposalHistory
  // AFTER UPDATE trigger writes the snapshot rows the transition FKs against.
  const created = [];
  for (const spec of PROPOSALS) {
    const proposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      proposalData: {
        title: spec.title,
        collaborationDocId: spec.collaborationDocId,
      },
      status: ProposalStatus.DRAFT,
    });
    created.push({ ...spec, id: proposal.id });
  }
  await db
    .update(proposalsTable)
    .set({ status: ProposalStatus.SUBMITTED })
    .where(
      inArray(
        proposalsTable.id,
        created.map((p) => p.id),
      ),
    );
  for (const proposal of created) {
    await addProposalToCategory({
      proposalId: proposal.id,
      taxonomyTermId: termByLabel.get(proposal.category)!,
    });
  }

  // Scope: R1 → District 1; R2 → Districts 1 + 2. District 3 stays uncovered.
  await createCategoryReviewer({
    processInstanceId: instance.instance.id,
    taxonomyTermId: termByLabel.get('District 1')!,
    reviewerProfileId: r1.profileId,
  });
  await createCategoryReviewer({
    processInstanceId: instance.instance.id,
    taxonomyTermId: termByLabel.get('District 1')!,
    reviewerProfileId: r2.profileId,
  });
  await createCategoryReviewer({
    processInstanceId: instance.instance.id,
    taxonomyTermId: termByLabel.get('District 2')!,
    reviewerProfileId: r2.profileId,
  });

  return { instance, termByLabel, r1, r2 };
}

/** Opens a signed-in page for a given instance member in a fresh context. */
async function openAsUser(
  browser: Browser,
  email: string,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await authenticateAsUser(page, {
    email,
    password: TEST_USER_DEFAULT_PASSWORD,
  });
  return { page, close: () => context.close() };
}

test.describe('Reviews by category', () => {
  test('builder: scope radio reveals per-category reviewer cards with role-holder-only picker', async ({
    authenticatedPage: page,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `rbc-builder-${testInfo.workerIndex}-${Date.now()}`;
    const template = await getSeededTemplate();

    // Draft instance — the builder autosaves scope only for drafts, so the
    // "reload → persisted" assertion reflects the real write path.
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: reviewSchema('all'),
      status: ProcessStatus.DRAFT,
    });

    const terms = await ensureProposalCategoryTerms([...CATEGORY_LABELS]);
    await setInstanceCategories(
      instance.instance.id,
      instance.instance.instanceData as DecisionInstanceData,
      terms,
    );

    await createNamedReviewer({
      supabaseAdmin,
      testId: `${testId}-rev`,
      instanceProfileId: instance.profileId,
      name: 'Reviewer One',
    });
    // A plain instance member WITHOUT the reviewer role — must never be a
    // picker candidate (scope ≠ capability).
    const { user: plainMember } = await createInstanceMember({
      supabaseAdmin,
      testId: `${testId}-plain`,
      instanceProfileId: instance.profileId,
    });
    await db
      .update(profiles)
      .set({ name: 'Plain Member' })
      .where(eq(profiles.id, plainMember.profileId));

    await openReviewsBuilderStep(page, instance.slug);

    // The scope radio starts on "All proposals"; picking "By category" reveals
    // one card per category. Wait for the scope write to persist (draft
    // autosave) so the later reload reflects it.
    const byCategoryRadio = page.getByRole('radio', { name: /By category/ });
    await expect(byCategoryRadio).toBeVisible({ timeout: 36_000 });

    const scopeSaved = page.waitForResponse(
      (response) =>
        response.url().includes('updateDecisionInstance') &&
        response.request().method() === 'POST',
    );
    // React Aria renders the radio <input> as sr-only behind the label, so
    // click the visible label text (mirrors review-submit.spec's radio group).
    await page.getByText('By category', { exact: true }).click();
    await scopeSaved;

    for (const label of CATEGORY_LABELS) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible({
        timeout: 15_000,
      });
    }

    // Picker candidates: only role-holders. Open District 1's combobox.
    const district1 = categoryCard(page, 'District 1');
    await district1.getByRole('combobox').click();
    await expect(
      page.getByRole('option', { name: 'Reviewer One', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('option', { name: 'Plain Member', exact: true }),
    ).toHaveCount(0);

    // Add the reviewer to District 1 → chip + count update.
    const added = page.waitForResponse(
      (response) =>
        response.url().includes('addCategoryReviewer') &&
        response.request().method() === 'POST',
    );
    await page
      .getByRole('option', { name: 'Reviewer One', exact: true })
      .click();
    await added;

    await expect(district1.getByText('Reviewer One')).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      district1.getByText('1 reviewer', { exact: true }),
    ).toBeVisible();

    // District 3 stays empty → orange 0-reviewers state.
    const district3 = categoryCard(page, 'District 3');
    await expect(
      district3.getByText('0 reviewers', { exact: true }),
    ).toBeVisible();
    await expect(district3.getByText(/No reviewers yet\./)).toBeVisible();

    // Reload → scope persisted (cards render) and the reviewer chip persisted.
    await page.evaluate(() =>
      localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE'),
    );
    await openReviewsBuilderStep(page, instance.slug);
    await expect(
      categoryCard(page, 'District 1').getByText('Reviewer One'),
    ).toBeVisible({ timeout: 36_000 });
  });

  test('reviewer queue is scoped to assigned categories with a category header suffix', async ({
    authenticatedPage: page,
    browser,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `rbc-queue-${testInfo.workerIndex}-${Date.now()}`;
    const { instance, r1, r2 } = await seedByCategoryInstance(
      org,
      supabaseAdmin,
      testId,
    );

    // Real generation-at-transition (self-review excluded, scoped by category).
    await advanceToReviewViaUI(page, instance.slug);

    // R1 (District 1) sees only P1 with an "in District 1" suffix.
    const reviewerOne = await openAsUser(browser, r1.email);
    try {
      await reviewerOne.page.goto(`/en/decisions/${instance.slug}/current`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(
        reviewerOne.page.getByRole('tab', { name: 'Proposals to review' }),
      ).toBeVisible({ timeout: 36_000 });

      const queue = reviewerOne.page.getByRole('tabpanel').first();
      await expect(
        queue.getByText('in District 1', { exact: true }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(queue.getByText('Community Solar Initiative')).toBeVisible();
      // Out-of-scope proposals never reach R1's queue tab.
      await expect(queue.getByText('Community Garden Project')).toHaveCount(0);
      await expect(queue.getByText('Youth Mentorship Program')).toHaveCount(0);
    } finally {
      await reviewerOne.close();
    }

    // R2 (Districts 1+2) sees P1 + P2 with a comma-joined suffix.
    const reviewerTwo = await openAsUser(browser, r2.email);
    try {
      await reviewerTwo.page.goto(`/en/decisions/${instance.slug}/current`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(
        reviewerTwo.page.getByRole('tab', { name: 'Proposals to review' }),
      ).toBeVisible({ timeout: 36_000 });

      const queue = reviewerTwo.page.getByRole('tabpanel').first();
      await expect(
        queue.getByText('in District 1, District 2', { exact: true }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(queue.getByText('Community Solar Initiative')).toBeVisible();
      await expect(queue.getByText('Community Garden Project')).toBeVisible();
      await expect(queue.getByText('Youth Mentorship Program')).toHaveCount(0);
    } finally {
      await reviewerTwo.close();
    }
  });

  test('adding a reviewer to a category mid-phase reconciles into their queue', async ({
    authenticatedPage: page,
    browser,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `rbc-reconcile-${testInfo.workerIndex}-${Date.now()}`;
    const { instance, r1 } = await seedByCategoryInstance(
      org,
      supabaseAdmin,
      testId,
    );

    await advanceToReviewViaUI(page, instance.slug);

    // Admin adds Reviewer One to District 3 via the builder card, live in the
    // review phase. addCategoryReviewer awaits the reconcile before responding.
    await openReviewsBuilderStep(page, instance.slug);
    const district3 = categoryCard(page, 'District 3');
    await expect(district3).toBeVisible({ timeout: 36_000 });
    await expect(
      district3.getByText('0 reviewers', { exact: true }),
    ).toBeVisible();

    await district3.getByRole('combobox').click();
    const added = page.waitForResponse(
      (response) =>
        response.url().includes('addCategoryReviewer') &&
        response.request().method() === 'POST',
    );
    await page
      .getByRole('option', { name: 'Reviewer One', exact: true })
      .click();
    await added;
    await expect(district3.getByText('Reviewer One')).toBeVisible({
      timeout: 10_000,
    });

    // R1's queue now contains P3 and the header includes District 3.
    const reviewerOne = await openAsUser(browser, r1.email);
    try {
      await reviewerOne.page.goto(`/en/decisions/${instance.slug}/current`, {
        waitUntil: 'domcontentloaded',
      });
      // Direct DB/reconcile writes race the persisted RQ cache — clear it,
      // then reload before asserting.
      await reviewerOne.page.evaluate(() =>
        localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE'),
      );
      await reviewerOne.page.reload({ waitUntil: 'domcontentloaded' });

      await expect(
        reviewerOne.page.getByRole('tab', { name: 'Proposals to review' }),
      ).toBeVisible({ timeout: 36_000 });

      const queue = reviewerOne.page.getByRole('tabpanel').first();
      await expect(queue.getByText('Youth Mentorship Program')).toBeVisible({
        timeout: 15_000,
      });
      await expect(queue.getByText(/District 3/)).toBeVisible();
    } finally {
      await reviewerOne.close();
    }
  });
});
