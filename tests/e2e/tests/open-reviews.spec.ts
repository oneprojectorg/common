import type {
  DecisionSchemaDefinition,
  RubricTemplateSchema,
} from '@op/common';
import {
  ProcessStatus,
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  processInstances,
} from '@op/db/schema';
import { db, eq } from '@op/db/test';
import {
  createDecisionInstance,
  createInstanceMember,
  createProposalReview,
  createReviewAssignment,
  createReviewScenario,
  getDecisionInstance,
  getSeededTemplate,
  grantInstanceReviewerRole,
} from '@op/test';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  expect,
  test,
} from '../fixtures/index.js';

// Mirrors OVERALL_RECOMMENDATION_KEY from @op/common/client. Inlined to
// sidestep CJS/ESM interop when loading @op/common from the e2e runner.
const OVERALL_RECOMMENDATION_KEY = '__overall_recommendation';

/**
 * A three-phase schema whose middle phase is a review phase. `openReviews`
 * flips the per-phase `rules.reviews.openReviews` opt-in so a single factory
 * serves all three scenarios (builder-off, reviewer-on, reviewer-off).
 */
function makeReviewSchema(openReviews: boolean): DecisionSchemaDefinition {
  return {
    id: 'open-reviews-e2e',
    version: '1.0.0',
    name: 'Open Reviews E2E',
    description: 'Schema for the open-reviews e2e tests.',
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
        name: 'Proposal Submission',
        description: 'Members submit proposals.',
        rules: {
          proposals: { submit: true },
          voting: { submit: false },
          advancement: { method: 'manual' as const },
        },
      },
      {
        // Phase id is 'review' so it matches the default `phaseId` used by
        // createReviewAssignment and the ReviewLayout's phase lookup.
        id: 'review',
        name: 'Review Stage',
        description: 'Reviewers evaluate proposals.',
        rules: {
          proposals: { submit: false, review: true },
          reviews: openReviews
            ? { submit: true, openReviews: true }
            : { submit: true },
          voting: { submit: false },
          advancement: { method: 'manual' as const },
        },
      },
      {
        id: 'results',
        name: 'Results',
        description: 'Final results.',
        rules: {
          proposals: { submit: false },
          voting: { submit: false },
          advancement: { method: 'manual' as const },
        },
      },
    ],
  } satisfies DecisionSchemaDefinition;
}

/**
 * Two scored criteria + an overall recommendation. Total possible per review =
 * max(innovation) + max(feasibility) = 5 + 3 = 8. Mirrors the review-summary
 * rubric so submitted scores render the same "N/8pts" shape.
 */
const RUBRIC_TEMPLATE = {
  type: 'object',
  required: ['innovation', 'feasibility', OVERALL_RECOMMENDATION_KEY],
  'x-field-order': ['innovation', 'feasibility', OVERALL_RECOMMENDATION_KEY],
  properties: {
    innovation: {
      type: 'integer',
      title: 'Innovation',
      'x-format': 'dropdown',
      minimum: 1,
      maximum: 5,
      oneOf: [
        { const: 1, title: '1' },
        { const: 2, title: '2' },
        { const: 3, title: '3' },
        { const: 4, title: '4' },
        { const: 5, title: '5' },
      ],
    },
    feasibility: {
      type: 'integer',
      title: 'Feasibility',
      'x-format': 'dropdown',
      minimum: 1,
      maximum: 3,
      oneOf: [
        { const: 1, title: '1' },
        { const: 2, title: '2' },
        { const: 3, title: '3' },
      ],
    },
    [OVERALL_RECOMMENDATION_KEY]: {
      type: 'string',
      title: 'Overall Recommendation',
      'x-format': 'dropdown',
      oneOf: [
        { const: 'yes', title: 'Yes' },
        { const: 'maybe', title: 'Maybe' },
        { const: 'no', title: 'No' },
      ],
    },
  },
} as const satisfies RubricTemplateSchema;

const PROPOSAL_TITLE = 'Community Solar Initiative';

/** Resolves a profile's display label the same way the reviewer rows do. */
async function getProfileDisplayName(profileId: string): Promise<string> {
  const profile = await db.query.profiles.findFirst({
    where: { id: profileId },
    columns: { name: true, slug: true },
  });
  return profile?.name ?? profile?.slug ?? profileId;
}

interface StoredPhase {
  phaseId: string;
  rules?: { reviews?: { openReviews?: boolean } };
}

/** Reads back the review phase's persisted `openReviews` flag from the DB. */
async function getPersistedOpenReviews(
  instanceId: string,
): Promise<boolean | undefined> {
  const saved = await getDecisionInstance(instanceId);
  const phases =
    (saved.instanceData as { phases?: StoredPhase[] }).phases ?? [];
  const reviewPhase = phases.find((p) => p.phaseId === 'review');
  return reviewPhase?.rules?.reviews?.openReviews;
}

test.describe('Open Reviews', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  // ==========================================================================
  // Test 1 — Builder toggle + confirm dialog
  // ==========================================================================
  test('builder Open reviews toggle opens a confirm dialog and persists once enabled', async ({
    authenticatedPage: page,
    org,
  }) => {
    test.setTimeout(120_000);

    const template = await getSeededTemplate();
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      // Review already enabled on the middle phase so the "Open reviews" row
      // renders immediately (it is gated behind reviews-v2 + isReviewPhase).
      schema: makeReviewSchema(false),
      // Draft so the builder autosaves to the server on every edit. (Published
      // processes hold edits in memory until an explicit "Update Process".)
      status: ProcessStatus.DRAFT,
    });

    const editUrl = `/en/decisions/${instance.slug}/edit`;
    const sidebarNav = page.getByRole('navigation', {
      name: 'Section navigation',
    });
    const reviewPhaseButton = sidebarNav.getByRole('button', {
      name: 'Review Stage',
      exact: true,
    });
    // The ToggleRow renders <p>Open reviews</p> next to the ToggleButton; walk
    // up two parents to the row root, then grab its toggle. `exact` keeps the
    // label match off the "Turn on Open Reviews?" dialog copy.
    const openReviewsToggle = () =>
      page
        .getByText('Open reviews', { exact: true })
        .locator('..')
        .locator('..')
        .getByRole('switch');

    await page.goto(editUrl);
    await expect(
      page.getByRole('heading', { name: 'Process Settings' }),
    ).toBeVisible({ timeout: 18_000 });

    await expect(reviewPhaseButton).toBeVisible({ timeout: 12_000 });
    await reviewPhaseButton.click();

    // Open reviews row is visible and off to start.
    await expect(page.getByText('Open reviews', { exact: true })).toBeVisible({
      timeout: 12_000,
    });
    await expect(openReviewsToggle()).toHaveAttribute('aria-checked', 'false');

    // Turning it on opens a confirmation dialog.
    await openReviewsToggle().click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Turn on Open Reviews?')).toBeVisible();

    // Cancel leaves the toggle off and nothing persisted.
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(openReviewsToggle()).toHaveAttribute('aria-checked', 'false');

    // Toggle again → Enable persists via the builder autosave mutation.
    await openReviewsToggle().click();
    const dialog2 = page.getByRole('alertdialog');
    await expect(dialog2).toBeVisible();

    const saveResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('decision.updateDecisionInstance') && resp.ok(),
      { timeout: 15_000 },
    );
    await dialog2.getByRole('button', { name: 'Enable' }).click();
    await saveResponse;

    await expect(openReviewsToggle()).toHaveAttribute('aria-checked', 'true');

    // The flag reached the DB.
    await expect
      .poll(() => getPersistedOpenReviews(instance.instance.id), {
        timeout: 10_000,
      })
      .toBe(true);

    // Persists after a reload. Drop the persisted React Query cache first so
    // the fresh load reads the saved instance rather than a stale snapshot.
    await page.evaluate(() =>
      window.localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE'),
    );
    await page.goto(editUrl);
    await expect(
      page.getByRole('heading', { name: 'Process Settings' }),
    ).toBeVisible({ timeout: 18_000 });
    await expect(reviewPhaseButton).toBeVisible({ timeout: 12_000 });
    await reviewPhaseButton.click();
    await expect(page.getByText('Open reviews', { exact: true })).toBeVisible({
      timeout: 12_000,
    });
    await expect(openReviewsToggle()).toHaveAttribute('aria-checked', 'true');
  });

  // ==========================================================================
  // Test 2 — Reviewer sees other reviews when open reviews is on
  // ==========================================================================
  test('reviewer sees My review / Other reviews tabs and can drill into another review', async ({
    browser,
    org,
    supabaseAdmin,
  }, testInfo) => {
    test.setTimeout(120_000);

    const testId = `open-reviews-${testInfo.workerIndex}-${Date.now()}`;
    const template = await getSeededTemplate();

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: makeReviewSchema(true),
    });

    // Inject the rubric and move the instance into the (open) review phase.
    // The aggregates gate checks the instance's CURRENT phase, so this must be
    // 'review'.
    await db
      .update(processInstances)
      .set({
        instanceData: {
          ...(instance.instance.instanceData as Record<string, unknown>),
          rubricTemplate: RUBRIC_TEMPLATE,
        },
        currentStateId: 'review',
      })
      .where(eq(processInstances.id, instance.instance.id));

    // Two reviewers, each a member + granted the Reviewer role (READ + REVIEW).
    const { user: reviewerA } = await createInstanceMember({
      supabaseAdmin,
      testId: `${testId}-a`,
      instanceProfileId: instance.profileId,
    });
    const { user: reviewerB } = await createInstanceMember({
      supabaseAdmin,
      testId: `${testId}-b`,
      instanceProfileId: instance.profileId,
    });
    await grantInstanceReviewerRole({
      instanceProfileId: instance.profileId,
      authUserId: reviewerA.authUserId,
      email: reviewerA.email,
      roleName: `Reviewer-A-${testId}`,
    });
    await grantInstanceReviewerRole({
      instanceProfileId: instance.profileId,
      authUserId: reviewerB.authUserId,
      email: reviewerB.email,
      roleName: `Reviewer-B-${testId}`,
    });

    // Proposal + reviewer A's assignment (flips proposal to SUBMITTED and
    // writes the history row the assignments anchor to).
    const {
      proposal,
      assignedProposalHistoryId,
      assignment: assignmentA,
    } = await createReviewScenario({
      instance: { id: instance.instance.id },
      author: {
        profileId: org.organizationProfile.id,
        authUserId: org.adminUser.authUserId,
        email: org.adminUser.email,
      },
      reviewer: { profileId: reviewerA.profileId },
      proposalData: {
        title: PROPOSAL_TITLE,
        collaborationDocId: 'test-proposal-view-doc',
      },
      assignmentStatus: ProposalReviewAssignmentStatus.COMPLETED,
    });

    // Reviewer B's assignment on the same proposal snapshot.
    const assignmentB = await createReviewAssignment({
      processInstanceId: instance.instance.id,
      proposalId: proposal.id,
      reviewerProfileId: reviewerB.profileId,
      assignedProposalHistoryId,
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });

    const submittedAt = new Date().toISOString();
    const feedbackFromA = 'Fund this — the strongest applicant in the pool.';

    // Reviewer A: "Yes", 5 + 3 = 8/8. Includes a rationale + feedback so the
    // drill-in has rubric answer content and feedback-to-author text.
    await createProposalReview({
      assignmentId: assignmentA.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: {
        answers: {
          innovation: 5,
          feasibility: 3,
          [OVERALL_RECOMMENDATION_KEY]: 'yes',
        },
        rationales: { innovation: 'Genuinely novel and well-scoped.' },
      },
      overallComment: feedbackFromA,
      submittedAt,
    });

    // Reviewer B's OWN submitted review — "No". It must be filtered out of B's
    // "Other reviews" list (excluded by the viewer's own profile id).
    await createProposalReview({
      assignmentId: assignmentB.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: {
        answers: {
          innovation: 2,
          feasibility: 1,
          [OVERALL_RECOMMENDATION_KEY]: 'no',
        },
        rationales: {},
      },
      overallComment: 'Not ready this round.',
      submittedAt,
    });

    const reviewerAName = await getProfileDisplayName(reviewerA.profileId);

    // Sign in as reviewer B and open B's review screen for the proposal.
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const bPage = await ctx.newPage();
    await authenticateAsUser(bPage, {
      email: reviewerB.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await bPage.goto(
      `/en/decisions/${instance.slug}/reviews/${assignmentB.id}`,
      {
        waitUntil: 'domcontentloaded',
      },
    );

    // Both tabs render when open reviews is on.
    const myReviewTab = bPage.getByRole('tab', { name: 'My review' });
    const otherReviewsTab = bPage.getByRole('tab', { name: 'Other reviews' });
    await expect(myReviewTab).toBeVisible({ timeout: 36_000 });
    await expect(otherReviewsTab).toBeVisible();

    // Switch to Other reviews. Scope assertions to this panel: the "My review"
    // panel is force-mounted (so the form keeps state) and holds B's OWN
    // submitted review, whose rubric headings would otherwise collide.
    await otherReviewsTab.click();
    const otherPanel = bPage.getByRole('tabpanel', { name: 'Other reviews' });

    // Average bar + Yes group + A's row with score.
    await expect(
      otherPanel.getByText('Average Score', { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(otherPanel.getByText('Yes (1)')).toBeVisible();
    // No "No" group — reviewer B's own "No" review is excluded.
    await expect(otherPanel.getByText(/^No \(\d+\)$/)).toHaveCount(0);

    // Exactly one reviewer row (A only); B's own review never appears.
    const reviewerRows = otherPanel.getByRole('button', {
      name: /^View review by /,
    });
    await expect(reviewerRows).toHaveCount(1);
    const aRow = reviewerRows.first();
    await expect(aRow).toContainText('8/8pts');
    await expect(aRow).toContainText(reviewerAName);

    // Drill into A's review.
    await aRow.click();

    await expect(
      otherPanel.getByRole('button', { name: 'Back to all reviewers' }),
    ).toBeVisible({ timeout: 10_000 });
    // A's name in the detail header, the recommendation badge, and the score.
    await expect(otherPanel.getByText(reviewerAName).first()).toBeVisible();
    await expect(otherPanel.getByText('(8/8)')).toBeVisible();
    // Rubric answer content + feedback-to-author text.
    await expect(
      otherPanel.getByRole('heading', { name: 'Innovation' }),
    ).toBeVisible();
    await expect(otherPanel.getByText(feedbackFromA)).toBeVisible();

    // Back to the list.
    await otherPanel
      .getByRole('button', { name: 'Back to all reviewers' })
      .click();
    await expect(otherPanel.getByText('Yes (1)')).toBeVisible();

    await ctx.close();
  });

  // ==========================================================================
  // Test 3 — Open reviews off: plain form, no tabs
  // ==========================================================================
  test('reviewer sees the plain review form with no tabs when open reviews is off', async ({
    browser,
    org,
    supabaseAdmin,
  }, testInfo) => {
    test.setTimeout(120_000);

    const testId = `open-reviews-off-${testInfo.workerIndex}-${Date.now()}`;
    const template = await getSeededTemplate();

    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: makeReviewSchema(false),
    });

    await db
      .update(processInstances)
      .set({
        instanceData: {
          ...(instance.instance.instanceData as Record<string, unknown>),
          rubricTemplate: RUBRIC_TEMPLATE,
        },
        currentStateId: 'review',
      })
      .where(eq(processInstances.id, instance.instance.id));

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

    const { assignment } = await createReviewScenario({
      instance: { id: instance.instance.id },
      author: {
        profileId: org.organizationProfile.id,
        authUserId: org.adminUser.authUserId,
        email: org.adminUser.email,
      },
      reviewer: { profileId: reviewer.profileId },
      proposalData: {
        title: PROPOSAL_TITLE,
        collaborationDocId: 'test-proposal-view-doc',
      },
    });

    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const rPage = await ctx.newPage();
    await authenticateAsUser(rPage, {
      email: reviewer.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await rPage.goto(
      `/en/decisions/${instance.slug}/reviews/${assignment.id}`,
      {
        waitUntil: 'domcontentloaded',
      },
    );

    // The plain review form renders (rubric criterion + submit action) with no
    // tab strip at all.
    await expect(
      rPage.getByRole('button', { name: 'Submit review' }),
    ).toBeVisible({ timeout: 36_000 });
    await expect(
      rPage.getByRole('heading', { name: 'Innovation' }),
    ).toBeVisible();

    await expect(rPage.getByRole('tab', { name: 'My review' })).toHaveCount(0);
    await expect(rPage.getByRole('tab', { name: 'Other reviews' })).toHaveCount(
      0,
    );

    await ctx.close();
  });
});
