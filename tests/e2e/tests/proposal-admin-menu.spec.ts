import {
  createDecisionInstance,
  createInstanceMember,
  createProposal,
  getSeededTemplate,
  testMinimalSchema,
} from '@op/common/testing/data';
import { ProposalStatus } from '@op/db/schema';

import {
  TEST_USER_DEFAULT_PASSWORD,
  authenticateAsUser,
  expect,
  test,
} from '../fixtures/index.js';

test.describe('Proposal page admin menu', () => {
  test('is offered to a decision admin but not to a participant viewing their own proposal', async ({
    authenticatedPage: adminPage,
    browser,
    org,
    supabaseAdmin,
  }) => {
    const template = await getSeededTemplate();
    const instance = await createDecisionInstance({
      processId: template.id,
      ownerProfileId: org.organizationProfile.id,
      authUserId: org.adminUser.authUserId,
      email: org.adminUser.email,
      schema: testMinimalSchema,
    });
    const { user: participant } = await createInstanceMember({
      supabaseAdmin,
      testId: `proposal-admin-menu-${Date.now()}`,
      instanceProfileId: instance.profileId,
    });

    // The author holds admin on the proposal's own profile, which is not
    // decision admin.
    const proposal = await createProposal({
      processInstanceId: instance.instance.id,
      submittedByProfileId: participant.profileId,
      authUserId: participant.authUserId,
      email: participant.email,
      proposalData: { title: 'Participant Proposal' },
      status: ProposalStatus.SUBMITTED,
    });
    const proposalUrl = `/en/decisions/${instance.slug}/proposal/${proposal.profileId}`;

    const participantContext = await browser.newContext();
    const participantPage = await participantContext.newPage();
    await authenticateAsUser(participantPage, {
      email: participant.email,
      password: TEST_USER_DEFAULT_PASSWORD,
    });
    await participantPage.goto(proposalUrl, { waitUntil: 'load' });
    await expect(
      participantPage.getByRole('heading', { name: 'Participant Proposal' }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      participantPage.getByRole('button', { name: 'Proposal options' }),
    ).toHaveCount(0);
    await participantContext.close();

    await adminPage.goto(proposalUrl, { waitUntil: 'load' });
    await adminPage
      .getByRole('button', { name: 'Proposal options' })
      .click({ timeout: 30_000 });
    await expect(
      adminPage.getByRole('menuitem', { name: 'Merge with another proposal' }),
    ).toBeVisible();
    await expect(
      adminPage.getByRole('menuitem', { name: 'Hide proposal' }),
    ).toBeVisible();
  });
});
