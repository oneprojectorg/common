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
  test('exports the phase in full, whatever the list has been narrowed to', async ({
    authenticatedPage,
    org,
    request,
  }) => {
    // Page load, then a real background workflow round trip on top of it.
    test.setTimeout(150_000);

    // The export is a background Inngest workflow: the mutation only returns an
    // id, and the file is produced by the handler apps/api mounts at
    // /api/v1/workflows. The dev server that relays the event back to it is
    // started by `webServer` in playwright.config.ts, so it is up by the time
    // this runs — but a reused one belongs to the :3300 stack and has never
    // seen the e2e app on :4300, so its functions are registered here.
    const sync = await request.fetch(WORKFLOWS_SERVE_URL, { method: 'PUT' });
    expect(sync.ok()).toBe(true);

    const { instance, slug } = await createProcessAndInstance({ org });

    const inFilter = await createProposal({
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

    const outOfFilter = await createProposal({
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
      .values({ proposalId: inFilter.id, taxonomyTermId: category.id });

    // Narrow the list by category up front, and leave it narrowed. The export
    // no longer follows the list, so running it from a filtered view is what
    // makes the row count below an assertion rather than a coincidence: an
    // export that still inherited the filter would return one row here instead
    // of two. Both proposals sit in the same phase, which is what the export
    // covers. The filter is URL state (nuqs), so it is set by navigation rather
    // than by driving the dropdown.
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
      name: 'Export all',
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

    // The reported bug. Supabase serves a signed URL inline unless the URL asks
    // for an attachment, so the CSV arrived as something the browser was free
    // to display — Safari painted it as text in a new window rather than saving
    // it. The anchor's `download` attribute cannot cover this: it is ignored
    // cross-origin, and the link points at the Supabase host. This is the only
    // test that reaches a real signed URL, so it is where the workflow's own
    // signing site (which has no unit test behind it) gets covered.
    expect(download.headers()['content-disposition']).toContain('attachment');
    expect(download.headers()['content-type']).toContain('text/csv');

    const rows = parse(await download.text(), {
      columns: true,
    }) as Record<string, string>[];

    // Both rows. The list on screen is showing one proposal and the file
    // carries the other as well, which is the whole point of an export that no
    // longer follows the filter. One row here would mean it still does.
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row['Proposal ID']).sort()).toEqual(
      [inFilter.id, outOfFilter.id].sort(),
    );

    // Found by id rather than taken by position: rows arrive in the proposal
    // query's own order, which is not the order they were seeded in.
    const exported = rows.find((row) => row['Proposal ID'] === inFilter.id);

    expect(exported).toMatchObject({
      Title: 'Community Garden Project',
      Budget: '8000',
      Currency: 'USD',
      Categories: 'Environment',
    });

    // The submitter column reads the *profile* row, so it is asserted against
    // that rather than against the account that signed in.
    const [submitter] = await db
      .select({ name: profiles.name })
      .from(profiles)
      .where(eq(profiles.id, org.adminUser.profileId));

    expect(exported?.['Submitted By']).toBe(submitter?.name);
    expect(exported).not.toHaveProperty('Submitter Email');

    // Description comes from the `summary` fragment. Reading only the legacy
    // `default` fragment — as this did — exported an empty column for every
    // templated proposal.
    expect(exported?.Description).toContain(FIXTURE_SUMMARY_TEXT);
    expect(exported?.Description).toContain(FIXTURE_SUMMARY_LIST_ITEM);
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
