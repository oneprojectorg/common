import type { DecisionSchemaDefinition } from '@op/common';
import {
  type CreateOrganizationResult,
  createDecisionInstance,
  createInstanceMember,
  createProposal,
  createProposalReview,
  createReviewScenario,
  getSeededTemplate,
  grantInstanceAdminWithoutReviewRole,
} from '@op/common/testing/data';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  ProposalStatus,
  processInstances,
} from '@op/db/schema';
import { db, eq } from '@op/db/test';

import { expect, test } from '../fixtures/index.js';

// Review phase (`proposals.review: true`), the phase the review surface routes on.
const REVIEW_SCHEMA = {
  id: 'admin-review-progress-e2e',
  version: '1.0.0',
  name: 'Admin Review Progress E2E',
  description: 'Schema for the admin "Proposals in review" e2e test.',
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
      id: 'review',
      name: 'Review',
      description: 'Reviewers evaluate proposals.',
      rules: {
        proposals: { submit: false, review: true },
        voting: { submit: false },
        advancement: { method: 'manual' as const },
      },
    },
  ],
} satisfies DecisionSchemaDefinition;

// Card titles come from the collab-doc fragment the e2e mock pre-seeds for these doc IDs.
const REVIEWED_TITLE = 'Community Garden Project'; // test-proposal-listing-doc
const UNREVIEWED_TITLE = 'Youth Mentorship Program'; // test-proposal-listing-doc-alt

// `PROPOSALS_PAGE_LIMIT` in apps/app: one full page plus one row on the next.
const PAGE_SIZE = 24;
const PROPOSAL_COUNT = PAGE_SIZE + 1;

/**
 * An instance in its review phase whose admin holds no review capability — the
 * seeded global Admin role carries the profile ADMIN bit that would bypass it,
 * hence no admin access from the factory.
 */
async function seedReviewInstanceWithoutReviewAdmin(
  org: CreateOrganizationResult,
) {
  const template = await getSeededTemplate();

  const instance = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema: REVIEW_SCHEMA,
    grantAdminAccess: false,
  });

  await grantInstanceAdminWithoutReviewRole({
    instanceProfileId: instance.profileId,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
  });

  await db
    .update(processInstances)
    .set({ currentStateId: 'review' })
    .where(eq(processInstances.id, instance.instance.id));

  const author = {
    profileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
  };

  return { instance, author };
}

/** Proposal ids carried by one tRPC GET to `listWithReviewAggregates`. */
function countAggregateIds(url: string): number {
  const input = new URL(url).searchParams.get('input') ?? '{}';
  const calls: unknown[] = Object.values(JSON.parse(input));

  return calls.reduce<number>((count, call) => {
    if (typeof call !== 'object' || call === null || !('json' in call)) {
      return count;
    }
    const { json } = call;
    if (typeof json !== 'object' || json === null || !('proposalIds' in json)) {
      return count;
    }
    return Array.isArray(json.proposalIds)
      ? count + json.proposalIds.length
      : count;
  }, 0);
}

function isAggregatesRequest(url: URL) {
  return url.pathname.includes('decision.listWithReviewAggregates');
}

test.describe('Admin review progress', () => {
  test('an admin without the review capability gets the single "Proposals in review" list', async ({
    authenticatedPage: page,
    org,
    supabaseAdmin,
  }) => {
    const { instance, author } =
      await seedReviewInstanceWithoutReviewAdmin(org);

    // Somebody else does the reviewing — this admin holds no assignments, which
    // is exactly why the assignment queue has nothing to tab against.
    const reviewer = await createInstanceMember({
      supabaseAdmin,
      testId: `admin-review-progress-${Date.now()}`,
      organization: { id: org.organization.id },
      instanceProfileId: instance.profileId,
    });

    const reviewed = await createReviewScenario({
      instance: { id: instance.instance.id },
      author,
      reviewer: { profileId: reviewer.user.profileId },
      assignmentStatus: ProposalReviewAssignmentStatus.COMPLETED,
      proposalData: {
        title: REVIEWED_TITLE,
        collaborationDocId: 'test-proposal-listing-doc',
      },
    });
    await createProposalReview({
      assignmentId: reviewed.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: { answers: {} },
      submittedAt: new Date().toISOString(),
      reviewedProposalHistoryId: reviewed.assignedProposalHistoryId,
    });

    // No assignments at all → "0 Reviewed" rather than nothing: the zero is the
    // signal the admin is tracking.
    const unreviewed = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: author.profileId,
      authUserId: author.authUserId,
      email: author.email,
      status: ProposalStatus.SUBMITTED,
      proposalData: {
        title: UNREVIEWED_TITLE,
        collaborationDocId: 'test-proposal-listing-doc-alt',
      },
    });

    await page.goto(`/en/decisions/${instance.slug}/current`, {
      waitUntil: 'domcontentloaded',
    });

    // The admin hero is shared with the two-tab variant; the list header below
    // is what distinguishes this surface.
    await expect(
      page.getByRole('heading', { name: 'Review Progress' }).first(),
    ).toBeVisible({ timeout: 36_000 });

    // The reviewer queue tab is gone: an admin who is not a reviewer has no
    // queue to tab against.
    await expect(
      page.getByRole('heading', { name: '2 proposals', level: 3 }).first(),
    ).toBeVisible({ timeout: 36_000 });
    await expect(
      page.getByRole('tab', { name: 'Proposals to review' }),
    ).toHaveCount(0);

    const table = page.getByRole('table', { name: 'All proposals' });
    await expect(table).toBeVisible({ timeout: 36_000 });
    await expect(
      table.getByRole('link', { name: REVIEWED_TITLE }),
    ).toHaveAttribute(
      'href',
      new RegExp(
        `/decisions/${instance.slug}/proposal/${reviewed.proposal.profileId}/reviews$`,
      ),
    );
    await expect(table.getByText('1 of 1', { exact: true })).toBeVisible();

    // No assignments: a dash in the cell, "No assignments" to a screen reader.
    const unreviewedRow = table.getByRole('row', {
      name: new RegExp(UNREVIEWED_TITLE),
    });
    await expect(
      unreviewedRow.getByRole('link', { name: UNREVIEWED_TITLE }),
    ).toHaveAttribute(
      'href',
      new RegExp(
        `/decisions/${instance.slug}/proposal/${unreviewed.profileId}/reviews$`,
      ),
    );
    await expect(unreviewedRow.getByText('No assignments')).toHaveCount(2);
  });

  test('review progress loads one page at a time, and a page that fails settles to the empty mark', async ({
    authenticatedPage: page,
    org,
  }) => {
    const { instance, author } =
      await seedReviewInstanceWithoutReviewAdmin(org);

    for (let index = 0; index < PROPOSAL_COUNT; index += 1) {
      await createProposal({
        processInstanceId: instance.instance.id,
        submittedByProfileId: author.profileId,
        authUserId: author.authUserId,
        email: author.email,
        status: ProposalStatus.SUBMITTED,
        proposalData: { title: `Proposal ${index + 1}` },
      });
    }

    // The first page's aggregates load normally. The second page's request is
    // held so the rows it covers can be inspected mid-flight, then dropped.
    const idCounts: number[] = [];
    let releaseSecondPage = () => {};
    const secondPageHeld = new Promise<void>((resolve) => {
      releaseSecondPage = resolve;
    });

    await page.route(isAggregatesRequest, async (route) => {
      idCounts.push(countAggregateIds(route.request().url()));

      if (idCounts.length < 2) {
        await route.continue();
        return;
      }

      await secondPageHeld;
      await route.abort();
    });

    await page.goto(`/en/decisions/${instance.slug}/current`, {
      waitUntil: 'domcontentloaded',
    });

    const table = page.getByRole('table', { name: 'All proposals' });
    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(PAGE_SIZE, { timeout: 36_000 });

    // Every first-page row settles: no assignments, so the dash plus its label
    // in both review cells.
    const settledRows = rows.filter({ hasText: 'No assignments' });
    await expect(settledRows).toHaveCount(PAGE_SIZE, { timeout: 36_000 });

    await page
      .getByTestId('proposals-infinite-scroll-sentinel')
      .scrollIntoViewIfNeeded();
    await expect(rows).toHaveCount(PROPOSAL_COUNT, { timeout: 36_000 });
    await expect.poll(() => idCounts.length).toBe(2);

    // While the second page's aggregates are in flight, the first page keeps
    // its counts and only the new row waits.
    const newRow = rows.nth(PAGE_SIZE);
    await expect(newRow.locator('[data-slot="skeleton"]')).toHaveCount(2);
    await expect(settledRows).toHaveCount(PAGE_SIZE);

    releaseSecondPage();

    await expect(newRow.getByText('Review progress unavailable')).toHaveCount(
      2,
    );
    await expect(newRow.locator('[data-slot="skeleton"]')).toHaveCount(0);
    await expect(settledRows).toHaveCount(PAGE_SIZE);

    // Each request carries one list page of ids at most.
    expect(idCounts).toEqual([PAGE_SIZE, PROPOSAL_COUNT - PAGE_SIZE]);
  });
});
