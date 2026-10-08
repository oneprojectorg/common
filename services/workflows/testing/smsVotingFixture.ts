import type { DecisionSchemaDefinition, PhoneNumber } from '@op/common';
import {
  createDecisionInstance,
  createDecisionProcess,
  createProposal,
  createUser,
  grantDecisionProfileAccess,
  makeDecisionPublic,
} from '@op/common/testing/data';
import {
  TestPhoneAuthDataManager,
  createTestAdminClient,
} from '@op/common/testing/helpers';
import { db, eq, inArray } from '@op/db/client';
import {
  ProposalStatus,
  processInstances,
  profiles,
  users,
} from '@op/db/schema';
import { randomUUID } from 'node:crypto';

type RegisterCleanup = (fn: () => void | Promise<void>) => void;

export interface FixtureAccount {
  authUserId: string;
  profileId: string;
  email: string | null;
}

export const VOTING_PHASE_ID = 'voting';

export const votingSchema = (
  maxVotesPerMember: number,
): DecisionSchemaDefinition => ({
  id: 'sms-voting',
  version: '1.0.0',
  name: 'SMS Voting',
  description: 'A process whose voting phase is open to SMS replies',
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: {
        proposals: { submit: true },
        voting: { submit: false },
        advancement: { method: 'manual' as const },
      },
    },
    {
      id: VOTING_PHASE_ID,
      name: 'Voting',
      rules: {
        proposals: { submit: false },
        voting: { submit: true, maxVotesPerMember },
        advancement: { method: 'manual' as const },
      },
    },
    {
      id: 'results',
      name: 'Results',
      rules: {
        proposals: { submit: false },
        voting: { submit: false },
        advancement: { method: 'manual' as const },
      },
    },
  ],
});

const readProfileId = async (authUserId: string) => {
  const [row] = await db
    .select({ profileId: users.profileId })
    .from(users)
    .where(eq(users.authUserId, authUserId))
    .limit(1);

  if (!row?.profileId) {
    throw new Error(`The signup trigger created no profile for ${authUserId}`);
  }

  return row.profileId;
};

export class SmsVotingFixture {
  private readonly phoneAuth: TestPhoneAuthDataManager;
  private readonly admin = createTestAdminClient();
  private readonly profileIds: string[] = [];
  private readonly emailAuthUserIds: string[] = [];

  constructor(
    private readonly testId: string,
    onTestFinished: RegisterCleanup,
  ) {
    this.phoneAuth = new TestPhoneAuthDataManager(testId, onTestFinished);
    onTestFinished(() => this.cleanup());
  }

  async createPhoneOnlyAccount(phone: PhoneNumber): Promise<FixtureAccount> {
    const authUserId = await this.phoneAuth.createUser({
      phone,
      confirmed: true,
    });
    return {
      authUserId,
      profileId: await readProfileId(authUserId),
      email: null,
    };
  }

  async createEmailAccount(): Promise<FixtureAccount> {
    const email = `${this.testId}-${randomUUID().slice(0, 6)}@oneproject.org`;
    const { id } = await createUser({ supabaseAdmin: this.admin, email });
    this.emailAuthUserIds.push(id);
    return { authUserId: id, profileId: await readProfileId(id), email };
  }

  async createVotingInstance({
    owner,
    maxVotesPerMember,
    proposalTitles,
    name,
    currentPhaseId = VOTING_PHASE_ID,
  }: {
    owner: FixtureAccount;
    maxVotesPerMember: number;
    proposalTitles: string[];
    name?: string;
    currentPhaseId?: string;
  }) {
    const schema = votingSchema(maxVotesPerMember);
    const process = await createDecisionProcess({
      createdByProfileId: owner.profileId,
      schema,
    });
    const { instance, profileId, slug } = await createDecisionInstance({
      processId: process.id,
      ownerProfileId: owner.profileId,
      authUserId: owner.authUserId,
      email: owner.email,
      name,
      schema,
      grantAdminAccess: false,
    });
    this.profileIds.push(profileId);

    const proposals = [];
    for (const title of proposalTitles) {
      const proposal = await createProposal({
        processInstanceId: instance.id,
        submittedByProfileId: owner.profileId,
        proposalData: { title },
        status: ProposalStatus.SUBMITTED,
      });
      this.profileIds.push(proposal.profileId);
      proposals.push(proposal);
    }

    await db
      .update(processInstances)
      .set({ currentStateId: currentPhaseId })
      .where(eq(processInstances.id, instance.id));

    return {
      instanceId: instance.id,
      instanceProfileId: profileId,
      slug,
      proposals,
    };
  }

  async addMember(instanceProfileId: string, member: FixtureAccount) {
    await grantDecisionProfileAccess({
      profileId: instanceProfileId,
      authUserId: member.authUserId,
      email: member.email,
      isAdmin: false,
    });
  }

  async makePublic(instanceProfileId: string) {
    await makeDecisionPublic({ profileId: instanceProfileId });
  }

  private async cleanup() {
    if (this.profileIds.length > 0) {
      await db.delete(profiles).where(inArray(profiles.id, this.profileIds));
    }
    for (const authUserId of this.emailAuthUserIds) {
      const [row] = await db
        .select({ profileId: users.profileId })
        .from(users)
        .where(eq(users.authUserId, authUserId))
        .limit(1);
      await this.admin.auth.admin.deleteUser(authUserId);
      if (row?.profileId) {
        await db.delete(profiles).where(eq(profiles.id, row.profileId));
      }
    }
  }
}
