import {
  EntityType,
  ProcessStatus,
  ProposalStatus,
  decisionProcesses,
  processInstances,
  profileUserToAccessRoles,
  profileUsers,
  profiles,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { db } from '@op/db/test';
import { createProposal } from '@op/test';
import { parse } from 'csv-parse/sync';
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

const INNGEST_HEALTH_URL = 'http://127.0.0.1:8288/health';
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
  phases: [
    {
      phaseId: 'proposalSubmission',
      startDate: '2025-09-20',
      endDate: '2025-10-01',
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

    // The export is a background Inngest workflow: the mutation only returns an
    // id, and the file is produced by the handler apps/api mounts at
    // /api/v1/workflows. The dev server is what relays the event back to it —
    // without one, `event.send` has nowhere to go and nothing ever completes.
    //
    // Checked here rather than in `beforeAll`, where `test.skip()` has no
    // TestInfo to attach to and throws instead of skipping.
    const isReachable = await request
      .get(INNGEST_HEALTH_URL)
      .then((response) => response.ok())
      .catch(() => false);

    const guidance =
      'Inngest dev server is not running on :8288. Start it with ' +
      '`pnpm w:workflows exec inngest-cli dev --no-discovery ' +
      '-u http://localhost:4300/api/v1/workflows` — see tests/e2e/README.md.';

    // Hard failure in CI, which starts one: a skip there would report a green
    // run for a spec that never executed.
    if (!isReachable && process.env.CI) {
      throw new Error(guidance);
    }
    test.skip(!isReachable, guidance);

    // Sync this build's functions into whichever dev server is listening. In CI
    // the `-u` flag already did it; locally the running dev server belongs to
    // the :3300 stack and has never seen the e2e app on :4300.
    const sync = await request.fetch(WORKFLOWS_SERVE_URL, { method: 'PUT' });
    expect(sync.ok()).toBe(true);

    const { instance, slug } = await createProcessAndInstance({ org });

    const included = await createProposal({
      processInstanceId: instance.id,
      submittedByProfileId: org.organizationProfile.id,
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
      submittedByProfileId: org.organizationProfile.id,
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

    // Narrow the list by category up front. An export that ignored the filter
    // and one that applied it are indistinguishable on an unfiltered list, so
    // this is what makes the row count below an assertion rather than a
    // coincidence. The filter is URL state (nuqs), so it is set by navigation
    // rather than by driving the dropdown.
    await authenticatedPage.goto(
      `/en/decisions/${slug}/current?filter=all&category=Environment`,
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
    await expect(downloadLink).toBeVisible({ timeout: 90_000 });

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
      'Submitter Email': org.adminUser.email,
    });

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
