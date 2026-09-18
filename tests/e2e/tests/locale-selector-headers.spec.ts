import type { DecisionSchemaDefinition } from '@op/common';
import { processInstances } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import {
  type CreateOrganizationResult,
  createDecisionInstance,
  createInstanceMember,
  createReviewScenario,
  getSeededTemplate,
  grantInstanceReviewerRole,
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

const LOCALE_CHOOSER_NAME = 'Select language';

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
        reviews: { submit: true, allowRevisions: true },
        voting: { submit: false },
        advancement: { method: 'manual' as const },
      },
    },
  ],
} satisfies DecisionSchemaDefinition;

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
      maximum: 3,
      oneOf: [
        { const: 1, title: '1' },
        { const: 2, title: '2' },
        { const: 3, title: '3' },
      ],
    },
  },
};

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

  // Both routes 403 on a stateless instance.
  const [, { user: reviewer }] = await Promise.all([
    db
      .update(processInstances)
      .set({
        instanceData: {
          ...(instance.instance.instanceData as Record<string, unknown>),
          rubricTemplate: RUBRIC_TEMPLATE,
        },
        currentStateId: 'review',
      })
      .where(eq(processInstances.id, instance.instance.id)),
    createInstanceMember({
      supabaseAdmin,
      testId: `${testId}-reviewer`,
      instanceProfileId: instance.profileId,
    }),
  ]);

  await grantInstanceReviewerRole({
    instanceProfileId: instance.profileId,
    authUserId: reviewer.authUserId,
    email: reviewer.email,
    roleName: `Reviewer-${testId}`,
  });

  const { proposal, assignment } = await createReviewScenario({
    instance: { id: instance.instance.id },
    author: {
      profileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
    },
    reviewer: { profileId: reviewer.profileId },
    proposalData: {
      title: 'Locale chooser coverage proposal',
      collaborationDocId: 'test-proposal-view-doc',
    },
  });

  return { instance, proposal, assignment, reviewer };
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

    await page.goto(`/en/decisions/${instance.slug}/assignments`, {
      waitUntil: 'domcontentloaded',
    });
    await expectLocaleChooser(page);

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

    // A member who is not the assigned reviewer matches neither branch of
    // ProposalReviewsLayout, so the route calls forbidden().
    const { user: member } = await createInstanceMember({
      supabaseAdmin,
      testId: `${testId}-member`,
      instanceProfileId: instance.profileId,
    });

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

  test('stays on screen at a phone width with every review action shown', async ({
    browser,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const { instance, assignment, reviewer } = await createDecisionInReview({
      org,
      supabaseAdmin,
      testId: `locale-mobile-${testInfo.workerIndex}-${Date.now()}`,
    });

    const context = await browser.newContext({
      viewport: { width: 375, height: 800 },
    });
    const page = await context.newPage();
    await authenticateAsUser(page, {
      email: reviewer.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });

    await page.goto(`/en/decisions/${instance.slug}/reviews/${assignment.id}`, {
      waitUntil: 'domcontentloaded',
    });

    const chooser = page.getByRole('button', { name: LOCALE_CHOOSER_NAME });
    await expect(chooser).toBeVisible({ timeout: 30_000 });
    // Request revision and Submit review are both in the row at this width.
    await expect(
      page.getByRole('button', { name: 'Request revision' }),
    ).toBeVisible();

    const header = page.locator('header').first();
    const overflow = await header.evaluate(
      (el) => el.scrollWidth - el.clientWidth,
    );
    expect(overflow).toBe(0);

    const box = await chooser.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375);

    await context.close();
  });

  test('appears on the onboarding screen', async ({ page, supabaseAdmin }) => {
    // createUser leaves onboardedAt unset, which is what keeps /start rendering.
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
