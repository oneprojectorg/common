import { listResultNotificationRecipients, processResults } from '@op/common';
import { db, desc, eq } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  decisionProcessResults,
  profileUsers,
  profiles,
  stateTransitionHistory,
  users,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { schemaWithoutPipeline } from '../../../test/helpers/pipelineSchemas';

/**
 * The unit tests mock the resolver, the schema and the db client, so nothing
 * there proves a proposal profile actually carries `profileUsers` rows, that
 * `profileUsers.authUser` resolves, or that the name join finds anything.
 * These run against a real database to close that gap.
 */

const MESSAGES = { funded: 'You were funded', notFunded: 'Not this round' };

/** Attaches an extra person to a proposal's profile, as an accepted invite does. */
async function addProposalCollaborator({
  proposalProfileId,
  authUserId,
  email,
}: {
  proposalProfileId: string;
  authUserId: string;
  email: string | null;
}): Promise<void> {
  await db
    .insert(profileUsers)
    .values({ profileId: proposalProfileId, authUserId, email });
}

/**
 * Lands an instance on its final phase with results published and the author
 * copy stamped, then returns the refs the workflow's event would carry.
 */
async function publishResults(
  testData: TestDecisionsDataManager,
  titles: Array<string>,
) {
  const setup = await testData.createDecisionSetup({
    processSchema: schemaWithoutPipeline,
    instanceCount: 1,
    status: ProcessStatus.PUBLISHED,
  });
  const instanceId = setup.instance.instance.id;

  const proposals = [];
  for (const title of titles) {
    proposals.push(
      await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title },
        status: ProposalStatus.SUBMITTED,
      }),
    );
  }

  await testData.advancePhase({
    instanceId,
    fromPhaseId: 'submission',
    toPhaseId: 'review',
  });

  const processResultId = await processResults({
    processInstanceId: instanceId,
  });

  const [transition] = await db
    .select({ id: stateTransitionHistory.id })
    .from(stateTransitionHistory)
    .where(eq(stateTransitionHistory.processInstanceId, instanceId))
    .orderBy(desc(stateTransitionHistory.transitionedAt))
    .limit(1);

  if (!transition) {
    throw new Error('Expected a transition row');
  }

  await db
    .update(stateTransitionHistory)
    .set({
      transitionData: {
        manualSelection: { resultNotifications: MESSAGES },
      },
    })
    .where(eq(stateTransitionHistory.id, transition.id));

  return {
    setup,
    instanceId,
    proposals,
    processResultId,
    transitionHistoryId: transition.id,
    resolve: () =>
      listResultNotificationRecipients({
        processInstanceId: instanceId,
        processResultId,
        transitionHistoryId: transition.id,
        previousPhaseId: 'submission',
      }),
  };
}

describe.concurrent('listResultNotificationRecipients', () => {
  it('reaches a proposal author at their sign-in address, named from their profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, resolve } = await publishResults(testData, [
      `Proposal ${task.id}`,
    ]);

    const result = await resolve();

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const author = result.notification.recipients.find(
      ({ email }) => email === setup.userEmail,
    );
    expect(author).toBeDefined();
    expect(author?.values.name).toBeTruthy();
    // No allocation is ever written, so the token has nothing to resolve to.
    expect(author?.values.amount).toBe('');
  });

  // The snapshot column is stale by design; delivery must ignore it in favour
  // of auth.users, which is what the shared resolver reads.
  it('ignores the profileUsers email snapshot for a collaborator', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, proposals, resolve } = await publishResults(testData, [
      `Collaborative ${task.id}`,
    ]);
    const proposal = proposals[0];
    if (!proposal) {
      throw new Error('Expected a seeded proposal');
    }

    const collaborator = await testData.createMemberUser({
      organization: setup.organization,
    });
    const staleEmail = `stale-${collaborator.email}`;
    await addProposalCollaborator({
      proposalProfileId: proposal.profileId,
      authUserId: collaborator.authUserId,
      email: staleEmail,
    });

    const result = await resolve();

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const emails = result.notification.recipients.map(({ email }) => email);
    expect(emails).toContain(collaborator.email);
    expect(emails).not.toContain(staleEmail);
  });

  // A collaborator can be attached to a proposal before they finish onboarding,
  // so the name lookup finds nothing. Losing the greeting must not lose the
  // announcement — this publish cannot be re-triggered.
  it('still reaches an author whose profile carries no name', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, proposals, resolve } = await publishResults(testData, [
      `Unonboarded ${task.id}`,
    ]);
    const proposal = proposals[0];
    if (!proposal) {
      throw new Error('Expected a seeded proposal');
    }

    const collaborator = await testData.createMemberUser({
      organization: setup.organization,
    });
    await addProposalCollaborator({
      proposalProfileId: proposal.profileId,
      authUserId: collaborator.authUserId,
      email: collaborator.email,
    });

    // Detach the personal profile and clear the account name, reproducing an
    // invite accepted before onboarding finished.
    const [userRow] = await db
      .select({ profileId: users.profileId })
      .from(users)
      .where(eq(users.authUserId, collaborator.authUserId));
    await db
      .update(users)
      .set({ profileId: null, name: null })
      .where(eq(users.authUserId, collaborator.authUserId));
    if (userRow?.profileId) {
      await db.delete(profiles).where(eq(profiles.id, userRow.profileId));
    }

    const result = await resolve();

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const nameless = result.notification.recipients.find(
      ({ email }) => email === collaborator.email,
    );
    expect(nameless).toBeDefined();
    expect(nameless?.values.name).toBe('there');
  });

  it('sends nothing once the announced result row has been retired', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { processResultId, resolve } = await publishResults(testData, [
      `Retired ${task.id}`,
    ]);

    await db
      .update(decisionProcessResults)
      .set({ success: false })
      .where(eq(decisionProcessResults.id, processResultId));

    await expect(resolve()).resolves.toEqual({
      ok: false,
      reason: 'resultRetired',
    });
  });
});
