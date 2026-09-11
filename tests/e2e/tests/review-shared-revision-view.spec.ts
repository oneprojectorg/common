import type {
  DecisionSchemaDefinition,
  RubricTemplateSchema,
} from '@op/common';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
  processInstances,
} from '@op/db/schema';
import { db, eq } from '@op/db/test';
import type { CreateOrganizationResult } from '@op/test';
import {
  createDecisionInstance,
  createInstanceMember,
  createReviewAssignment,
  createReviewScenario,
  getSeededTemplate,
  grantInstanceReviewerRole,
} from '@op/test';
import type { Browser, Locator, Page, TestInfo } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  expect,
  test,
} from '../fixtures/index.js';

/** Seeded before the test runs, on a third reviewer's assignment. */
const OTHER_COMMENT = 'Please add a detailed budget breakdown.';
/** Written through the request dialog by reviewer A. */
const OWN_COMMENT = 'Name the second site and break out the water costs.';

const REVIEW_SCHEMA = {
  id: 'shared-revision-view-schema',
  version: '1.0.0',
  name: 'Shared Revision View Schema',
  description:
    'Schema with a review-capable middle phase for the shared revision view test.',
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
    {
      id: 'results',
      name: 'Results',
      description: 'Final results',
      rules: {
        proposals: { submit: false },
        advancement: { method: 'manual' as const },
      },
    },
  ],
} satisfies DecisionSchemaDefinition;

// `maximum` is what makes `inferCriterionType` read this as `scored`: without
// it the renderer draws the prompt and no control at all.
const RUBRIC_TEMPLATE = {
  type: 'object',
  required: ['innovation'],
  'x-field-order': ['innovation'],
  properties: {
    innovation: {
      type: 'integer',
      title: 'Innovation',
      'x-format': 'dropdown',
      minimum: 1,
      maximum: 2,
      oneOf: [
        { const: 1, title: '1 — Poor' },
        { const: 2, title: '2 — Good' },
      ],
    },
  },
} as const satisfies RubricTemplateSchema;

test.describe('Review — shared revision request view', () => {
  test('an open request pauses nobody: both reviewers submit, both read every request, and only the owner can cancel', async ({
    browser,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const scenario = await setUpSharedRevisionScenario({
      org,
      supabaseAdmin,
      testInfo,
    });

    const reviewUrlA = `/en/decisions/${scenario.slug}/reviews/${scenario.reviewerAAssignmentId}`;
    const pageA = await openAs(browser, scenario.reviewerA.email);
    await pageA.goto(reviewUrlA, { waitUntil: 'domcontentloaded' });
    const paneA = reviewPane(pageA);

    await expect(paneA.getByText('Revision requested')).toBeVisible({
      timeout: 36_000,
    });
    // Polite, not sense `Alert`'s default assertive `role="alert"`.
    const alertA = paneA.getByRole('status');
    await expect(alertA).toHaveAttribute('aria-live', 'polite');
    await expect(alertA).toContainText('The author has been notified');

    // Scoped to the navbar: the request modal's submit button carries the same
    // accessible name, so a page-wide lookup matches both while it is open.
    const requestButtonA = pageA
      .getByRole('banner')
      .getByRole('button', { name: 'Request revision' });
    await expect(requestButtonA).toBeEnabled();
    await requestButtonA.click();

    const requestModal = dialog(pageA);
    await expect(requestModal).toBeVisible();
    await requestModal
      .getByRole('textbox', { name: 'What should the author change?' })
      .fill(OWN_COMMENT);
    await requestModal
      .getByRole('button', { name: 'Request revision' })
      .click();

    await expect(toast(pageA, 'Revision requested')).toBeVisible({
      timeout: 10_000,
    });

    // The toast can beat the modal's unmount, and the navbar button only
    // settles once the request has invalidated the review query.
    await expect(requestModal).toHaveCount(0);
    await expect(requestButtonA).toBeDisabled();

    await paneA.getByRole('button', { name: 'View request' }).click();

    const listModalA = dialog(pageA);
    await expect(
      listModalA.getByRole('heading', { name: 'Revision requests' }),
    ).toBeVisible();
    await expect(listModalA.getByText(OWN_COMMENT)).toBeVisible();
    await expect(listModalA.getByText(OTHER_COMMENT)).toBeVisible();
    await expect(listModalA.getByText(/^Your request •/)).toBeVisible();
    await expect(listModalA.getByText(scenario.reviewerC.email)).toHaveCount(0);
    await expect(
      listModalA.getByRole('button', { name: 'Cancel request' }),
    ).toHaveCount(1);

    await closeDialog(pageA, listModalA);

    await submitReview(pageA, paneA);
    await expect(toast(pageA, 'Review submitted successfully')).toBeVisible({
      timeout: 10_000,
    });

    expect(await ownRequestState(scenario.reviewerAAssignmentId)).toBe(
      ProposalReviewRequestState.REQUESTED,
    );
    expect(await ownRequestState(scenario.otherAssignmentId)).toBe(
      ProposalReviewRequestState.REQUESTED,
    );

    const pageB = await openAs(browser, scenario.reviewerB.email);
    await pageB.goto(
      `/en/decisions/${scenario.slug}/reviews/${scenario.reviewerBAssignmentId}`,
      { waitUntil: 'domcontentloaded' },
    );
    const paneB = reviewPane(pageB);

    await expect(paneB.getByText('Revision requested')).toBeVisible({
      timeout: 36_000,
    });
    await expect(
      pageB.getByRole('button', { name: 'Request revision' }),
    ).toBeEnabled();

    await paneB.getByRole('button', { name: 'View request' }).click();
    const listModalB = dialog(pageB);
    await expect(listModalB.getByText(OWN_COMMENT)).toBeVisible();
    await expect(listModalB.getByText(OTHER_COMMENT)).toBeVisible();
    await expect(
      listModalB.getByRole('button', { name: 'Cancel request' }),
    ).toHaveCount(0);
    await expect(listModalB.getByText(/^Your request •/)).toHaveCount(0);

    await closeDialog(pageB, listModalB);

    await submitReview(pageB, paneB);
    await expect(toast(pageB, 'Review submitted successfully')).toBeVisible({
      timeout: 10_000,
    });

    await pageA.goto(reviewUrlA, { waitUntil: 'domcontentloaded' });
    await expect(paneA.getByText('Revision requested')).toBeVisible({
      timeout: 36_000,
    });
    await paneA.getByRole('button', { name: 'View request' }).click();

    const cancelListModal = dialog(pageA);
    await cancelListModal
      .getByRole('button', { name: 'Cancel request' })
      .click();

    const confirm = pageA.getByRole('alertdialog');
    await expect(
      confirm.getByRole('heading', { name: 'Cancel revision request?' }),
    ).toBeVisible();
    await confirm.getByRole('button', { name: 'Cancel request' }).click();

    await expect(toast(pageA, 'Revision request cancelled')).toBeVisible({
      timeout: 10_000,
    });

    await expect(cancelListModal.getByText(OTHER_COMMENT)).toBeVisible();
    await expect(cancelListModal.getByText(OWN_COMMENT)).toHaveCount(0);
    expect(await ownRequestState(scenario.reviewerAAssignmentId)).toBe(
      ProposalReviewRequestState.CANCELLED,
    );
    expect(await ownRequestState(scenario.otherAssignmentId)).toBe(
      ProposalReviewRequestState.REQUESTED,
    );
  });
});

function reviewPane(page: Page): Locator {
  return page.locator('[data-slot="review-form"]').filter({ visible: true });
}

/** Toasts are dialogs too, so every dialog lookup has to exclude them. */
function dialog(page: Page): Locator {
  return page
    .getByRole('dialog')
    .and(page.locator(':not([data-slot="toast"])'));
}

function toast(page: Page, text: string): Locator {
  return page.locator('[data-slot="toast"]').filter({ hasText: text });
}

async function closeDialog(page: Page, modal: Locator): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
}

async function submitReview(page: Page, pane: Locator): Promise<void> {
  const submitButton = page.getByRole('button', { name: 'Submit review' });
  await expect(submitButton).toBeDisabled();

  await pane.getByRole('combobox', { name: 'Innovation' }).click();
  await page.getByRole('option', { name: '2 — Good' }).click();

  await expect(submitButton).toBeEnabled();
  await submitButton.click();
}

async function ownRequestState(
  assignmentId: string,
): Promise<string | undefined> {
  const stored = await db.query.proposalReviewRequests.findFirst({
    where: { assignmentId },
    orderBy: { createdAt: 'desc' },
  });
  return stored?.state;
}

/** Review phase, one proposal, three reviewers; reviewer C already has an open request. */
async function setUpSharedRevisionScenario({
  org,
  supabaseAdmin,
  testInfo,
}: {
  org: CreateOrganizationResult;
  supabaseAdmin: SupabaseClient;
  testInfo: TestInfo;
}) {
  const testId = `shared-rev-${testInfo.workerIndex}-${Date.now()}`;
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
    .set({
      instanceData: {
        ...(instance.instance.instanceData as Record<string, unknown>),
        rubricTemplate: RUBRIC_TEMPLATE,
      },
      currentStateId: 'review',
    })
    .where(eq(processInstances.id, instance.instance.id));

  const { user: author } = await createInstanceMember({
    supabaseAdmin,
    testId: `${testId}-author`,
    instanceProfileId: instance.profileId,
  });
  const { user: reviewerA } = await createInstanceMember({
    supabaseAdmin,
    testId: `${testId}-reviewer-a`,
    instanceProfileId: instance.profileId,
  });
  const { user: reviewerB } = await createInstanceMember({
    supabaseAdmin,
    testId: `${testId}-reviewer-b`,
    instanceProfileId: instance.profileId,
  });
  const { user: reviewerC } = await createInstanceMember({
    supabaseAdmin,
    testId: `${testId}-reviewer-c`,
    instanceProfileId: instance.profileId,
  });

  for (const [reviewer, roleName] of [
    [reviewerA, 'ReviewerA'],
    [reviewerB, 'ReviewerB'],
    [reviewerC, 'ReviewerC'],
  ] as const) {
    await grantInstanceReviewerRole({
      instanceProfileId: instance.profileId,
      authUserId: reviewer.authUserId,
      email: reviewer.email,
      roleName: `${roleName}-${testId}`,
    });
  }

  const {
    proposal,
    assignedProposalHistoryId,
    assignment: reviewerCAssignment,
    revisionRequest,
  } = await createReviewScenario({
    instance: { id: instance.instance.id },
    author,
    reviewer: { profileId: reviewerC.profileId },
    proposalData: {
      title: 'Community Solar Initiative',
      collaborationDocId: 'test-proposal-view-doc',
    },
    assignmentStatus: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    revisionRequest: {
      state: ProposalReviewRequestState.REQUESTED,
      requestComment: OTHER_COMMENT,
    },
  });

  if (!revisionRequest) {
    throw new Error('createReviewScenario did not return a revision request');
  }

  const reviewerAAssignment = await createReviewAssignment({
    processInstanceId: instance.instance.id,
    proposalId: proposal.id,
    reviewerProfileId: reviewerA.profileId,
    assignedProposalHistoryId,
  });
  const reviewerBAssignment = await createReviewAssignment({
    processInstanceId: instance.instance.id,
    proposalId: proposal.id,
    reviewerProfileId: reviewerB.profileId,
    assignedProposalHistoryId,
  });

  return {
    slug: instance.slug,
    reviewerA,
    reviewerB,
    reviewerC,
    otherAssignmentId: reviewerCAssignment.id,
    reviewerAAssignmentId: reviewerAAssignment.id,
    reviewerBAssignmentId: reviewerBAssignment.id,
  };
}

async function openAs(browser: Browser, email: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await authenticateAsUser(page, {
    email,
    password: TEST_USER_DEFAULT_PASSWORD,
  });
  return page;
}
