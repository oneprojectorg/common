import type { DecisionSchemaDefinition } from '@op/common';
import { ProposalReviewRequestState } from '@op/db/schema';
import {
  type CreateOrganizationResult,
  createDecisionInstance,
  createInstanceMember,
  createReviewScenario,
  getSeededTemplate,
} from '@op/test';
import type { Browser, Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  expect,
  test,
} from '../fixtures/index.js';

// Either side of the `sm` breakpoint (640px).
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1280, height: 900 };

const REVIEW_SCHEMA = {
  id: 'active-decisions-mobile-schema',
  version: '1.0.0',
  name: 'Active Decisions Mobile Schema',
  description:
    'Minimal submit + review schema for the landing page revision request row.',
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

test.describe('Landing page — Active Decisions revision request actions', () => {
  test('stack on mobile instead of overflowing the card', async ({
    browser,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const page = await openLandingPageWithRevisionRequest({
      browser,
      org,
      supabaseAdmin,
      testId: `active-dec-mobile-${testInfo.workerIndex}-${Date.now()}`,
      viewport: MOBILE_VIEWPORT,
    });

    const { ignoreBox, reviseBox } = await getActionBoxes(page);

    // Primary on top; the -1 absorbs sub-pixel rounding.
    expect(ignoreBox.y).toBeGreaterThanOrEqual(
      reviseBox.y + reviseBox.height - 1,
    );

    // The bug pushed the second button past the right edge.
    expect(ignoreBox.x + ignoreBox.width).toBeLessThanOrEqual(
      MOBILE_VIEWPORT.width,
    );
    expect(reviseBox.x + reviseBox.width).toBeLessThanOrEqual(
      MOBILE_VIEWPORT.width,
    );

    await page.context().close();
  });

  test('sit side by side above the sm breakpoint', async ({
    browser,
    org,
    supabaseAdmin,
  }, testInfo) => {
    const page = await openLandingPageWithRevisionRequest({
      browser,
      org,
      supabaseAdmin,
      testId: `active-dec-desktop-${testInfo.workerIndex}-${Date.now()}`,
      viewport: DESKTOP_VIEWPORT,
    });

    const { ignoreBox, reviseBox } = await getActionBoxes(page);

    // Source order here, so the mobile reversal must not leak up. x assumes LTR.
    expect(reviseBox.y).toBeLessThan(ignoreBox.y + ignoreBox.height);
    expect(reviseBox.x).toBeGreaterThan(ignoreBox.x);
    expect(reviseBox.x + reviseBox.width).toBeLessThanOrEqual(
      DESKTOP_VIEWPORT.width,
    );

    await page.context().close();
  });
});

/**
 * Seeds a proposal with a pending revision request and opens its author's
 * landing page, where the request renders as an Active Decisions row.
 */
async function openLandingPageWithRevisionRequest({
  browser,
  org,
  supabaseAdmin,
  testId,
  viewport,
}: {
  browser: Browser;
  org: CreateOrganizationResult;
  supabaseAdmin: SupabaseClient;
  testId: string;
  viewport: { width: number; height: number };
}): Promise<Page> {
  const template = await getSeededTemplate();

  const instance = await createDecisionInstance({
    processId: template.id,
    ownerProfileId: org.organizationProfile.id,
    authUserId: org.adminUser.authUserId,
    email: org.adminUser.email,
    schema: REVIEW_SCHEMA,
  });

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

  // Scoped by submitter, so only this author sees it.
  const { revisionRequest } = await createReviewScenario({
    instance: { id: instance.instance.id },
    author,
    reviewer: { profileId: reviewer.profileId },
    proposalData: {
      title: 'Community Solar Initiative',
      collaborationDocId: `${testId}-doc`,
    },
    revisionRequest: { state: ProposalReviewRequestState.REQUESTED },
  });

  if (!revisionRequest) {
    throw new Error('createReviewScenario did not return a revision request');
  }

  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await authenticateAsUser(page, {
    email: author.email,
    password: TEST_USER_DEFAULT_PASSWORD,
  });
  await page.goto('/en/');

  return page;
}

async function getActionBoxes(page: Page) {
  // Scoped to the row so another "Ignore" can't make this ambiguous.
  const row = page
    .getByRole('listitem')
    .filter({ hasText: 'Revision Request' });
  const ignore = row.getByRole('button', { name: 'Ignore' });
  const revise = row.getByRole('link', { name: 'Revise proposal' });

  await expect(ignore).toBeVisible({ timeout: 30_000 });
  await expect(revise).toBeVisible();

  const ignoreBox = await ignore.boundingBox();
  const reviseBox = await revise.boundingBox();

  if (!ignoreBox || !reviseBox) {
    throw new Error('Revision request actions have no layout box');
  }

  return { ignoreBox, reviseBox };
}
