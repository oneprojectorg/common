import { ValidationError, assertProfileTypeAccess } from '@op/common';
import { db } from '@op/db/client';
import { EntityType } from '@op/db/schema';
import { permission } from 'access-zones';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../test/helpers/TestDecisionsDataManager';

describe.concurrent('assertProfileTypeAccess', () => {
  describe('input handling', () => {
    it('returns without throwing when profileIds is empty', async () => {
      await expect(
        assertProfileTypeAccess({
          user: { id: randomUUID() },
          profileIds: [],
          policies: { [EntityType.ORG]: { decisions: permission.ADMIN } },
        }),
      ).resolves.toBeUndefined();
    });

    it('throws ValidationError when a profileId does not exist', async () => {
      await expect(
        assertProfileTypeAccess({
          user: { id: randomUUID() },
          profileIds: [randomUUID()],
          policies: { [EntityType.ORG]: { decisions: permission.ADMIN } },
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('treats a profile type not present in policies as a no-op', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({ instanceCount: 0 });

      // ORG profile, but the policy only gates DECISION → lenient pass-through.
      await expect(
        assertProfileTypeAccess({
          user: { id: randomUUID() },
          profileIds: [setup.organization.profileId],
          policies: {
            [EntityType.DECISION]: { decisions: permission.ADMIN },
          },
        }),
      ).resolves.toBeUndefined();
    });

    it('dedups duplicate profileIds before checking', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const { profileId } = setup.instances[0]!;

      await expect(
        assertProfileTypeAccess({
          user: { id: setup.user.id },
          profileIds: [profileId, profileId],
          policies: { [EntityType.DECISION]: { decisions: permission.ADMIN } },
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ORG profiles are gated through `organizationUsers`, not `profileUsers`, so
  // this helper has no visibility into org-admin status when ORG is included in
  // `policies`. Confirm the behaviour: gating ORG rejects even an org admin.
  describe('ORG profiles', () => {
    it('rejects an org admin because the helper only consults profileUsers', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({ instanceCount: 0 });

      await expect(
        assertProfileTypeAccess({
          user: { id: setup.user.id },
          profileIds: [setup.organization.profileId],
          policies: { [EntityType.ORG]: { decisions: permission.ADMIN } },
        }),
      ).rejects.toThrow();
    });

    it('outsider with no profileUser row fails any non-lenient policy', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({ instanceCount: 0 });

      await expect(
        assertProfileTypeAccess({
          user: { id: randomUUID() },
          profileIds: [setup.organization.profileId],
          policies: { [EntityType.ORG]: { decisions: permission.ADMIN } },
        }),
      ).rejects.toThrow();
    });
  });

  describe('DECISION profiles', () => {
    it('admin passes a decisions ADMIN policy', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const { profileId } = setup.instances[0]!;

      await expect(
        assertProfileTypeAccess({
          user: { id: setup.user.id },
          profileIds: [profileId],
          policies: { [EntityType.DECISION]: { decisions: permission.ADMIN } },
        }),
      ).resolves.toBeUndefined();
    });

    it('member fails a decisions ADMIN policy but passes a decisions READ policy', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: false,
      });
      const { profileId } = setup.instances[0]!;
      const member = await testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [profileId],
      });

      await expect(
        assertProfileTypeAccess({
          user: { id: member.authUserId },
          profileIds: [profileId],
          policies: { [EntityType.DECISION]: { decisions: permission.ADMIN } },
        }),
      ).rejects.toThrow();

      await expect(
        assertProfileTypeAccess({
          user: { id: member.authUserId },
          profileIds: [profileId],
          policies: { [EntityType.DECISION]: { decisions: permission.READ } },
        }),
      ).resolves.toBeUndefined();
    });

    it('outsider fails a decisions ADMIN policy', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: false,
      });
      const { profileId } = setup.instances[0]!;

      await expect(
        assertProfileTypeAccess({
          user: { id: randomUUID() },
          profileIds: [profileId],
          policies: { [EntityType.DECISION]: { decisions: permission.ADMIN } },
        }),
      ).rejects.toThrow();
    });
  });

  describe('PROPOSAL profiles', () => {
    it('creator (proposal-profile admin) passes an admin policy', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: setup.instances[0]!.instance.id,
        proposalData: { title: `Proposal ${task.id}` },
      });

      await expect(
        assertProfileTypeAccess({
          user: { id: setup.user.id },
          profileIds: [proposal.profileId],
          policies: { [EntityType.PROPOSAL]: { decisions: permission.ADMIN } },
        }),
      ).resolves.toBeUndefined();
    });

    it('non-creator org member fails an admin policy on a proposal profile', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: setup.instances[0]!.instance.id,
        proposalData: { title: `Proposal ${task.id}` },
      });
      const other = await testData.createMemberUser({
        organization: setup.organization,
      });

      await expect(
        assertProfileTypeAccess({
          user: { id: other.authUserId },
          profileIds: [proposal.profileId],
          policies: { [EntityType.PROPOSAL]: { decisions: permission.ADMIN } },
        }),
      ).rejects.toThrow();
    });
  });

  describe('INDIVIDUAL profiles', () => {
    it('owner of an individual profile passes a profile ADMIN policy', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({ instanceCount: 0 });
      const individualProfileId = await getIndividualProfileId(setup.user.id);

      await expect(
        assertProfileTypeAccess({
          user: { id: setup.user.id },
          profileIds: [individualProfileId],
          policies: {
            [EntityType.INDIVIDUAL]: { profile: permission.ADMIN },
          },
        }),
      ).resolves.toBeUndefined();
    });

    it('another user cannot satisfy a policy on someone else’s individual profile', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({ instanceCount: 0 });
      const individualProfileId = await getIndividualProfileId(setup.user.id);
      const stranger = await testData.createMemberUser({
        organization: setup.organization,
      });

      await expect(
        assertProfileTypeAccess({
          user: { id: stranger.authUserId },
          profileIds: [individualProfileId],
          policies: {
            [EntityType.INDIVIDUAL]: { profile: permission.ADMIN },
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('multiple profiles', () => {
    it('passes when the user has access on every gated profile', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const { profileId: decisionProfileId } = setup.instances[0]!;
      const individualProfileId = await getIndividualProfileId(setup.user.id);

      await expect(
        assertProfileTypeAccess({
          user: { id: setup.user.id },
          profileIds: [individualProfileId, decisionProfileId],
          policies: {
            [EntityType.INDIVIDUAL]: { profile: permission.ADMIN },
            [EntityType.DECISION]: { decisions: permission.ADMIN },
          },
        }),
      ).resolves.toBeUndefined();
    });

    it('throws when the user fails the policy on any one gated profile', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: false,
      });
      const { profileId: decisionProfileId } = setup.instances[0]!;
      // Member gets decision READ but no admin; expect to fail when policy
      // requires decisions.ADMIN on the decision profile.
      const member = await testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [decisionProfileId],
      });
      const memberIndividualProfileId = await getIndividualProfileId(
        member.authUserId,
      );

      await expect(
        assertProfileTypeAccess({
          user: { id: member.authUserId },
          profileIds: [memberIndividualProfileId, decisionProfileId],
          policies: {
            [EntityType.INDIVIDUAL]: { profile: permission.ADMIN },
            [EntityType.DECISION]: { decisions: permission.ADMIN },
          },
        }),
      ).rejects.toThrow();
    });

    it('checks only gated types when a mix of gated and non-gated profiles is passed', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const { profileId: decisionProfileId } = setup.instances[0]!;

      // ORG profile would reject this user (no profileUser row), but ORG is
      // not gated by the policy → only the DECISION check runs.
      await expect(
        assertProfileTypeAccess({
          user: { id: setup.user.id },
          profileIds: [setup.organization.profileId, decisionProfileId],
          policies: {
            [EntityType.DECISION]: { decisions: permission.READ },
          },
        }),
      ).resolves.toBeUndefined();
    });
  });
});

async function getIndividualProfileId(authUserId: string): Promise<string> {
  const user = await db.query.users.findFirst({
    where: { authUserId },
    columns: { profileId: true },
  });
  if (!user?.profileId) {
    throw new Error(`No individual profile for authUserId=${authUserId}`);
  }
  return user.profileId;
}
