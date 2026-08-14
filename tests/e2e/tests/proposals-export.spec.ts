import {
  EntityType,
  ProcessStatus,
  ProposalStatus,
  decisionProcesses,
  processInstances,
  profileUserToAccessRoles,
  profileUsers,
  profiles,
  proposalCategories,
  taxonomyTerms,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { db } from '@op/db/test';
import { createProposal } from '@op/test';
import { parse } from 'csv-parse/sync';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { expect, test } from '../fixtures/index.js';

/**
 * The collab mock (@op/collab/testing) pre-seeds these doc IDs with fixture
 * fragments keyed by template field name — `summary`, not `default`. That is
 * the shape the CSV's Description column previously read nothing from, so
 * asserting on it here is the regression, not incidental setup.
 */
const MOCK_DOC_ID = 'test-proposal-listing-doc';
const ALT_MOCK_DOC_ID = 'test-proposal-listing-doc-alt';

/** Text carried by the `summary` fragment of both fixture docs. */
const FIXTURE_SUMMARY_TEXT = 'Bold text';
const FIXTURE_SUMMARY_LIST_ITEM = 'First item';

const WORKFLOWS_SERVE_URL = 'http://localhost:4300/api/v1/workflows';

const processSchema = {
  id: 'export-spec',
  version: '1.0.0',
  name: 'Export Spec',
  description: 'Process used to exercise the proposals CSV export',
  phases: [
    {
      id: 'proposalSubmission',
      name: 'Proposal Submission',
      description: 'Submit proposals',
      rules: {
        proposals: { submit: true },
        voting: { submit: false },
        advancement: { method: 'manual' as const },
      },
    },
    // A phase after the current one, without which `DecisionStateRouter` sends
    // the whole route to `ResultsPage`: it renders results whenever the current
    // phase is the last one and doesn't accept submissions, so a single-phase
    // instance shows "The results are in." and never mounts a proposals list.
    {
      id: 'review',
      name: 'Review',
      description: 'Review proposals',
      rules: {
        proposals: { submit: false },
        voting: { submit: false },
        advancement: { method: 'manual' as const },
      },
    },
  ],
  proposalTemplate: {
    type: 'object',
    required: ['title'],
    'x-field-order': ['title', 'summary', 'budget', 'category'],
    properties: {
      title: { type: 'string', title: 'Title', 'x-format': 'short-text' },
      // `long-text` is what puts this fragment in the exported body — a format
      // outside TEXT_FORMATS would be skipped by `collectProposalBodyDoc`.
      summary: { type: 'string', title: 'Summary', 'x-format': 'long-text' },
      budget: {
        type: 'object',
        title: 'Budget',
        'x-format': 'money',
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string' },
        },
      },
      category: {
        type: ['string', 'null'],
        title: 'Category',
        'x-format': 'dropdown',
        oneOf: [
          { const: 'Environment', title: 'Environment' },
          { const: 'Education', title: 'Education' },
        ],
      },
    },
  },
};

const instanceData = {
  budget: 50000,
  hideBudget: false,
  proposalTemplate: processSchema.proposalTemplate,
  // Rules are carried on the instance's phases, not just the template's — the
  // router reads `currentPhase.rules` to decide the route, and the process
  // builder writes them here for the same reason.
  phases: [
    {
      phaseId: 'proposalSubmission',
      startDate: '2025-09-20',
      endDate: '2025-10-01',
      rules: {
        proposals: { submit: true },
        voting: { submit: false },
        advancement: { method: 'manual' as const },
      },
    },
    {
      phaseId: 'review',
      startDate: '2025-10-02',
      endDate: '2025-10-20',
      rules: {
        proposals: { submit: false },
        voting: { submit: false },
        advancement: { method: 'manual' as const },
      },
    },
  ],
};

test.describe('Proposals CSV export', () => {
  test('exports the filtered proposal list as a downloadable CSV', async ({
    authenticatedPage,
    org,
    request,
  }) => {
    // Page load, then a real background workflow round trip on top of it.
    test.setTimeout(150_000);

    // TEMPORARY DIAGNOSTIC — remove once the CI failure is understood.
    // The export reaches the browser over a single realtime broadcast. When
    // that broadcast goes missing the UI is indistinguishable from a job that
    // never started, so these three traces separate the possibilities: whether
    // the socket carried a join and a message, what the status endpoint
    // actually returned, and what the realtime manager logged.
    const wsFrames: string[] = [];
    const statusReads: string[] = [];
    const realtimeLogs: string[] = [];
    const since = Date.now();
    const at = () => `+${String(Date.now() - since).padStart(6)}ms`;

    authenticatedPage.on('websocket', (ws) => {
      if (!ws.url().includes('/realtime/v1/')) {
        return;
      }
      wsFrames.push(`${at()} socket opened`);
      ws.on('framesent', (frame) => {
        const payload = String(frame.payload);
        if (payload.includes('proposalExport')) {
          wsFrames.push(`${at()} sent ${payload.slice(0, 240)}`);
        }
      });
      ws.on('framereceived', (frame) => {
        const payload = String(frame.payload);
        if (
          payload.includes('proposalExport') ||
          payload.includes('invalidation')
        ) {
          wsFrames.push(`${at()} recv ${payload.slice(0, 240)}`);
        }
      });
      ws.on('close', () => wsFrames.push(`${at()} socket closed`));
    });

    authenticatedPage.on('console', (message) => {
      const text = message.text();
      if (text.includes('[Realtime]')) {
        realtimeLogs.push(`${at()} ${text}`);
      }
    });

    authenticatedPage.on('response', async (response) => {
      if (!response.url().includes('getExportStatus')) {
        return;
      }
      try {
        statusReads.push(`${at()} ${(await response.text()).slice(0, 300)}`);
      } catch {
        statusReads.push(`${at()} <body unavailable>`);
      }
    });

    const dumpDiagnostics = (label: string) => {
      console.log(`\n===== EXPORT DIAGNOSTICS (${label}) =====`);
      console.log(`--- websocket frames (${wsFrames.length}) ---`);
      wsFrames.forEach((line) => console.log(line));
      console.log(`--- getExportStatus responses (${statusReads.length}) ---`);
      statusReads.forEach((line) => console.log(line));
      console.log(`--- realtime console (${realtimeLogs.length}) ---`);
      realtimeLogs.forEach((line) => console.log(line));
      console.log('===== END EXPORT DIAGNOSTICS =====\n');
    };

    // The export is a background Inngest workflow: the mutation only returns an
    // id, and the file is produced by the handler apps/api mounts at
    // /api/v1/workflows. The dev server that relays the event back to it is
    // started by `webServer` in playwright.config.ts, so it is up by the time
    // this runs — but a reused one belongs to the :3300 stack and has never
    // seen the e2e app on :4300, so its functions are registered here.
    const sync = await request.fetch(WORKFLOWS_SERVE_URL, { method: 'PUT' });
    expect(sync.ok()).toBe(true);

    const { instance, slug } = await createProcessAndInstance({ org });

    const included = await createProposal({
      processInstanceId: instance.id,
      submittedByProfileId: org.adminUser.profileId,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      status: ProposalStatus.SUBMITTED,
      proposalData: {
        title: 'Community Garden Project',
        collaborationDocId: MOCK_DOC_ID,
        budget: { amount: 8000, currency: 'USD' },
        category: 'Environment',
      },
    });

    await createProposal({
      processInstanceId: instance.id,
      submittedByProfileId: org.adminUser.profileId,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      status: ProposalStatus.SUBMITTED,
      proposalData: {
        title: 'Youth Mentorship Program',
        collaborationDocId: ALT_MOCK_DOC_ID,
        budget: { amount: 12500, currency: 'EUR' },
        category: 'Education',
      },
    });

    // The category filter matches on a taxonomy term id, not on the label the
    // template offers — `resolveProposalListScope` reads `decision_categories`
    // and never looks at `proposalData.category`. So the category has to exist
    // as a term with a row joining it to the proposal it covers; passing
    // "Environment" straight through matches nothing and silently empties the
    // list.
    const [category] = await db
      .insert(taxonomyTerms)
      .values({ termUri: `e2e:category:${randomUUID()}`, label: 'Environment' })
      .returning();

    if (!category) {
      throw new Error('Failed to create the category term');
    }

    await db
      .insert(proposalCategories)
      .values({ proposalId: included.id, taxonomyTermId: category.id });

    // Narrow the list by category up front. An export that ignored the filter
    // and one that applied it are indistinguishable on an unfiltered list, so
    // this is what makes the row count below an assertion rather than a
    // coincidence. The filter is URL state (nuqs), so it is set by navigation
    // rather than by driving the dropdown.
    await authenticatedPage.goto(
      `/en/decisions/${slug}/current?filter=all&category=${category.id}`,
      { waitUntil: 'domcontentloaded' },
    );

    await expect(
      authenticatedPage.getByRole('link', { name: 'Community Garden Project' }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      authenticatedPage.getByRole('link', { name: 'Youth Mentorship Program' }),
    ).toHaveCount(0);

    const exportButton = authenticatedPage.getByRole('button', {
      name: 'Export',
    });
    await expect(exportButton).toBeEnabled();
    await exportButton.click();

    // The transient Preparing.../Generating... labels are deliberately not
    // asserted: a run that settles quickly can pass through both before
    // Playwright polls, which would make the assertion a race.
    const downloadLink = authenticatedPage.getByRole('link', {
      name: 'Download CSV',
    });
    try {
      await expect(downloadLink).toBeVisible({ timeout: 90_000 });
    } catch (error) {
      dumpDiagnostics('download link never appeared');
      throw error;
    }
    dumpDiagnostics('download link appeared');

    // Fetch the signed URL directly rather than going through the browser's
    // download: the point is the bytes, and the link is target="_blank", which
    // makes the download event the flakiest way to reach them.
    const signedUrl = await downloadLink.getAttribute('href');
    expect(signedUrl).toBeTruthy();

    const download = await request.get(signedUrl as string);
    expect(download.ok()).toBe(true);

    const rows = parse(await download.text(), {
      columns: true,
    }) as Record<string, string>[];

    // One row: the Education proposal is outside the active filter.
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      'Proposal ID': included.id,
      Title: 'Community Garden Project',
      Budget: '8000',
      Currency: 'USD',
      Categories: 'Environment',
    });

    // The submitter columns read the *profile* row, so they are asserted
    // against it rather than against the account that signed in. `Submitter
    // Email` reports `profiles.email`, which nothing in this fixture sets —
    // the address lives on `users`/`profile_users` — so only the name is
    // pinned here. A blank email column is the export reporting the profile
    // faithfully, not a join that failed.
    const [submitter] = await db
      .select({ name: profiles.name, email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, org.adminUser.profileId));

    expect(rows[0]?.['Submitted By']).toBe(submitter?.name);
    expect(rows[0]?.['Submitter Email']).toBe(submitter?.email ?? '');

    // Description comes from the `summary` fragment. Reading only the legacy
    // `default` fragment — as this did — exported an empty column for every
    // templated proposal.
    expect(rows[0]?.Description).toContain(FIXTURE_SUMMARY_TEXT);
    expect(rows[0]?.Description).toContain(FIXTURE_SUMMARY_LIST_ITEM);
  });
});

/**
 * Creates a decision process, its instance and profile, and grants the org's
 * admin the ADMIN role on that profile — which is what puts the export control
 * on screen.
 */
async function createProcessAndInstance({
  org,
}: {
  org: {
    organizationProfile: { id: string };
    adminUser: { authUserId: string; email: string };
  };
}) {
  const [process] = await db
    .insert(decisionProcesses)
    .values({
      name: 'Export Spec',
      description: 'Process for the e2e proposals export test',
      processSchema,
      createdByProfileId: org.organizationProfile.id,
    })
    .returning();

  if (!process) {
    throw new Error('Failed to create process');
  }

  const slug = `test-export-${randomUUID()}`;
  const name = `Export Spec ${randomUUID().slice(0, 8)}`;

  const [profile] = await db
    .insert(profiles)
    .values({ name, slug, type: EntityType.DECISION })
    .returning();

  if (!profile) {
    throw new Error('Failed to create instance profile');
  }

  const [instance] = await db
    .insert(processInstances)
    .values({
      name,
      processId: process.id,
      profileId: profile.id,
      instanceData,
      currentStateId: 'proposalSubmission',
      status: ProcessStatus.PUBLISHED,
      ownerProfileId: org.organizationProfile.id,
    })
    .returning();

  if (!instance) {
    throw new Error('Failed to create process instance');
  }

  const [profileUser] = await db
    .insert(profileUsers)
    .values({
      profileId: profile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
    })
    .returning();

  if (!profileUser) {
    throw new Error('Failed to grant admin access to the instance profile');
  }

  await db.insert(profileUserToAccessRoles).values({
    profileUserId: profileUser.id,
    accessRoleId: ROLES.ADMIN.id,
  });

  return { instance, profile, slug, name };
}
