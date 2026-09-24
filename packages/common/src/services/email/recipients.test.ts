import { db } from '@op/db/client';
import { EntityType, authUsers, profileUsers, profiles } from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../../testing/helpers/TestDecisionsDataManager';
import { TestOrganizationDataManager } from '../../../testing/helpers/TestOrganizationDataManager';
import {
  type EmailRecipient,
  listIndividualProfileRecipientsByProfileId,
  listMemberProfileRecipientsByProfile,
  listProfileRecipients,
} from './recipients';

/**
 * The snapshot column nothing syncs. Written on purpose so a resolver that
 * reads it delivers to the wrong inbox and fails these tests.
 */
const writeStaleSnapshot = async ({
  profileId,
  authUserId,
  email,
}: {
  profileId: string;
  authUserId: string;
  email: string | null;
}): Promise<void> => {
  await db.insert(profileUsers).values({ profileId, authUserId, email });
};

const makeAnonymous = async (authUserId: string): Promise<void> => {
  await db
    .update(authUsers)
    .set({ email: null, isAnonymous: true })
    .where(eq(authUsers.id, authUserId));
};

/** The setup admin creates the instance and so is already a member of it. */
const creatorOf = (setup: {
  user: { id: string };
  userEmail: string;
}): EmailRecipient => ({ authUserId: setup.user.id, email: setup.userEmail });

const byAccount = (recipients: Array<EmailRecipient>): Array<EmailRecipient> =>
  [...recipients].sort((a, b) => a.authUserId.localeCompare(b.authUserId));

describe.concurrent('listProfileRecipients', () => {
  it('addresses a member at their sign-in address, not the profileUsers snapshot', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const member = await testData.createMemberUser({
      organization: setup.organization,
    });
    await writeStaleSnapshot({
      profileId: setup.instance.profileId,
      authUserId: member.authUserId,
      email: `stale-${member.email}`,
    });

    const recipients = await listProfileRecipients({
      id: setup.instance.profileId,
      type: EntityType.DECISION,
    });

    expect(byAccount(recipients)).toEqual(
      byAccount([
        creatorOf(setup),
        { authUserId: member.authUserId, email: member.email },
      ]),
    );
  });

  it('gives an anonymous member a null address, not the snapshot', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const anonymous = await testData.createMemberUser({
      organization: setup.organization,
    });
    await makeAnonymous(anonymous.authUserId);
    await writeStaleSnapshot({
      profileId: setup.instance.profileId,
      authUserId: anonymous.authUserId,
      email: anonymous.email,
    });

    const recipients = await listProfileRecipients({
      id: setup.instance.profileId,
      type: EntityType.DECISION,
    });

    expect(byAccount(recipients)).toEqual(
      byAccount([
        creatorOf(setup),
        { authUserId: anonymous.authUserId, email: null },
      ]),
    );
  });

  it('returns one recipient when the same account holds two member rows', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const member = await testData.createMemberUser({
      organization: setup.organization,
    });
    for (const email of [`old-${member.email}`, `newer-${member.email}`]) {
      await writeStaleSnapshot({
        profileId: setup.instance.profileId,
        authUserId: member.authUserId,
        email,
      });
    }

    const recipients = await listProfileRecipients({
      id: setup.instance.profileId,
      type: EntityType.DECISION,
    });

    expect(byAccount(recipients)).toEqual(
      byAccount([
        creatorOf(setup),
        { authUserId: member.authUserId, email: member.email },
      ]),
    );
  });

  it("addresses an individual profile through its owner's account", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const owner = await testData.createMemberUser({
      organization: setup.organization,
    });

    await expect(
      listProfileRecipients({
        id: owner.profileId,
        type: EntityType.INDIVIDUAL,
      }),
    ).resolves.toEqual([{ authUserId: owner.authUserId, email: owner.email }]);
  });

  it('addresses an organization profile through its admins, not its members or contact address', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { organization, adminUsers, memberUsers } =
      await testData.createOrganization({ users: { admin: 2, member: 1 } });
    const profileId = organization.profileId;

    if (!profileId) {
      throw new Error('Test organization has no profile');
    }

    for (const member of memberUsers) {
      await writeStaleSnapshot({
        profileId,
        authUserId: member.authUserId,
        email: member.email,
      });
    }
    await db
      .update(profiles)
      .set({ email: `contact-${organization.id}@example.com` })
      .where(eq(profiles.id, profileId));

    const recipients = await listProfileRecipients({
      id: profileId,
      type: EntityType.ORG,
    });

    expect(recipients.map(({ email }) => email).sort()).toEqual(
      adminUsers.map(({ email }) => email).sort(),
    );
  });

  it('returns nothing for a profile that does not exist', async () => {
    await expect(
      listProfileRecipients({
        id: '11111111-1111-4111-8111-111111111111',
        type: EntityType.DECISION,
      }),
    ).resolves.toEqual([]);
  });
});

describe.concurrent('listMemberProfileRecipientsByProfile', () => {
  it('dedupes within a profile but keeps one person on two profiles under both', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 2 });
    const [first, second] = setup.instances;

    if (!first || !second) {
      throw new Error('Test setup created fewer than two instances');
    }

    const member = await testData.createMemberUser({
      organization: setup.organization,
    });
    for (const profileId of [
      first.profileId,
      first.profileId,
      second.profileId,
    ]) {
      await writeStaleSnapshot({
        profileId,
        authUserId: member.authUserId,
        email: member.email,
      });
    }

    const byProfile = await listMemberProfileRecipientsByProfile([
      first.profileId,
      second.profileId,
      first.profileId,
    ]);

    const expected = byAccount([
      creatorOf(setup),
      { authUserId: member.authUserId, email: member.email },
    ]);
    expect(byAccount(byProfile.get(first.profileId) ?? [])).toEqual(expected);
    expect(byAccount(byProfile.get(second.profileId) ?? [])).toEqual(expected);
    expect(byProfile.size).toBe(2);
  });

  it('returns an empty map for no profiles', async () => {
    await expect(listMemberProfileRecipientsByProfile([])).resolves.toEqual(
      new Map(),
    );
  });
});

describe.concurrent('listIndividualProfileRecipientsByProfileId', () => {
  it('groups owners by their individual profile and skips unknown ids', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const [first, second] = await Promise.all([
      testData.createMemberUser({ organization: setup.organization }),
      testData.createMemberUser({ organization: setup.organization }),
    ]);

    const byProfile = await listIndividualProfileRecipientsByProfileId([
      first.profileId,
      second.profileId,
      '11111111-1111-4111-8111-111111111111',
    ]);

    expect(byProfile.get(first.profileId)).toEqual([
      { authUserId: first.authUserId, email: first.email },
    ]);
    expect(byProfile.get(second.profileId)).toEqual([
      { authUserId: second.authUserId, email: second.email },
    ]);
    expect(byProfile.size).toBe(2);
  });

  it('returns an empty map for no profiles', async () => {
    await expect(
      listIndividualProfileRecipientsByProfileId([]),
    ).resolves.toEqual(new Map());
  });
});
