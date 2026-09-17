import type { DecisionSchemaDefinition } from '@op/common';
import { processInstances } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import {
  type CreateOrganizationResult,
  createDecisionInstance,
  createInstanceMember,
  createReviewScenario,
  getSeededTemplate,
} from '@op/test';
import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  createUser,
  expect,
  test,
} from '../fixtures/index.js';

/**
 * Screens outside the `(main)` tree render their own header instead of
 * SiteHeader, and each one has to carry the locale chooser itself. The chooser
 * is an icon-only globe button, so its accessible name is the only handle on it.
 */
const LOCALE_CHOOSER_NAME = 'Select language';

/** Every case asserts the same thing, on a route that server-renders first. */
function expectLocaleChooser(page: Page) {
  return expect(
    page.getByRole('button', { name: LOCALE_CHOOSER_NAME }),
  ).toBeVisible({ timeout: 30_000 });
}

const REVIEW_SCHEMA = {
  id: 'locale-selector-headers-e2e',
  version: '1.0.0',
  name: 'Locale Selector Headers E2E',
  description: 'Schema for the locale-chooser header coverage tests.',
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
        reviews: { submit: true },
        voting: { submit: false },
        advancement: { method: 'manual' as const },
      },
    },
  ],
} satisfies DecisionSchemaDefinition;

/** A decision parked in its review phase, with one proposal under review. */
async function createDecisionInReview({
  org,
  supabaseAdmin,
  testId,
}: {
  org: CreateOrganizationResult;
  supabaseAdmin: SupabaseClient;
  testId: string;
}) {
  const template = await getSeededTemplate();

  const instance = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema: REVIEW_SCHEMA,
  });

  // Both screens are phase-scoped: the assignments loader forbids a stateless
  // instance, and the summary resolves its reviews from the review phase. The
  // reviewer doesn't depend on the phase, so the two run together — creating
  // the reviewer goes through Supabase auth and is the slower of the pair.
  const [, { user: reviewer }] = await Promise.all([
    db
      .update(processInstances)
      .set({ currentStateId: 'review' })
      .where(eq(processInstances.id, instance.instance.id)),
    createInstanceMember({
      supabaseAdmin,
      testId: `${testId}-reviewer`,
      instanceProfileId: instance.profileId,
    }),
  ]);

  const { proposal } = await createReviewScenario({
    instance: { id: instance.instance.id },
    author: {
      profileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
    },
    reviewer: { profileId: reviewer.profileId },
    proposalData: { title: 'Locale chooser coverage proposal' },
  });

  return { instance, proposal };
}

test.describe('Locale chooser in headers', () => {
  test('appears on the decision review subpages', async ({
    authenticatedPage: page,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const { instance, proposal } = await createDecisionInReview({
      org,
      supabaseAdmin,
      testId: `locale-headers-${testInfo.workerIndex}-${Date.now()}`,
    });

    // AssignmentsPageShell: the Back row is the only chrome on this route.
    await page.goto(`/en/decisions/${instance.slug}/assignments`, {
      waitUntil: 'domcontentloaded',
    });
    await expectLocaleChooser(page);

    // DecisionSubpageHeader: shared by the review summary and the review form.
    await page.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}/reviews`,
      { waitUntil: 'domcontentloaded' },
    );
    await expectLocaleChooser(page);
  });

  test('appears on the decision forbidden screen', async ({
    page,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const testId = `locale-forbidden-${testInfo.workerIndex}-${Date.now()}`;
    const { instance, proposal } = await createDecisionInReview({
      org,
      supabaseAdmin,
      testId,
    });

    // Member-level access (READ, no ADMIN) on a proposal they were not
    // assigned: the summary route resolves neither branch and calls
    // forbidden(), which renders the decision-scoped forbidden screen.
    const { user: member } = await createInstanceMember({
      supabaseAdmin,
      testId: `${testId}-member`,
      instanceProfileId: instance.profileId,
    });

    // Replaces the worker admin's session on the shared page fixture, so the
    // context is torn down by Playwright even when an assertion below fails.
    await authenticateAsUser(page, {
      email: member.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await page.goto(
      `/en/decisions/${instance.slug}/proposal/${proposal.profileId}/reviews`,
      { waitUntil: 'domcontentloaded' },
    );

    await expect(
      page.getByRole('heading', { name: "You don't have access to this page" }),
    ).toBeVisible({ timeout: 36_000 });
    await expectLocaleChooser(page);
  });

  test('appears on the onboarding screen', async ({ page, supabaseAdmin }) => {
    // A fresh account with no onboardedAt — createUser leaves it unset, which
    // is what keeps the user on /start instead of bouncing into the app.
    const email = `e2e-locale-onboarding-${randomUUID().slice(0, 6)}@oneproject.org`;
    await createUser({ supabaseAdmin, email });

    await authenticateAsUser(page, {
      email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await page.goto('/en/start', { waitUntil: 'domcontentloaded' });

    await expectLocaleChooser(page);
  });
});
