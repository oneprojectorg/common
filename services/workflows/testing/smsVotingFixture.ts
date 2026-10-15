import {
  type DecisionSchemaDefinition,
  type PhoneNumber,
  advancePhase,
  createInstanceDataFromTemplate,
} from '@op/common';
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
  proposals,
  users,
} from '@op/db/schema';
import { DECISION_BITS, PERMISSIONS } from '@op/db/seedData/accessControl';
import { randomUUID } from 'node:crypto';

type RegisterCleanup = (fn: () => void | Promise<void>) => void;

export interface FixtureAccount {
  authUserId: string;
  profileId: string;
  email: string | null;
}

export const VOTING_PHASE_ID = 'voting';

export interface FixtureProposal {
  title: string;
  budget?: number;
  summary?: string;
  leftBehind?: boolean;
}

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
      selectionPipeline: {
        version: '1.0.0',
        blocks: [
          {
            id: 'advance-submitted',
            type: 'filter' as const,
            condition: {
              not: {
                operator: 'equals' as const,
                left: { field: 'proposalData.leftBehind' },
                right: { value: true },
              },
            },
          },
        ],
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
    firstCode,
  }: {
    owner: FixtureAccount;
    maxVotesPerMember: number;
    proposalTitles: Array<string | FixtureProposal>;
    name?: string;
    currentPhaseId?: string;
    firstCode?: number;
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

    if (firstCode !== undefined) {
      await db
        .update(processInstances)
        .set({ nextShortCode: firstCode })
        .where(eq(processInstances.id, instance.id));
    }

    const created = [];
    for (const entry of proposalTitles) {
      const { title, budget, summary, leftBehind } =
        typeof entry === 'string' ? { title: entry } : entry;
      const proposal = await createProposal({
        processInstanceId: instance.id,
        submittedByProfileId: owner.profileId,
        proposalData: {
          title,
          ...(budget === undefined
            ? {}
            : { budget: { amount: budget, currency: 'USD' } }),
          ...(summary === undefined ? {} : { summary }),
          ...(leftBehind ? { leftBehind } : {}),
        },
      });
      this.profileIds.push(proposal.profileId);
      await db
        .update(proposals)
        .set({ status: ProposalStatus.SUBMITTED })
        .where(eq(proposals.id, proposal.id));
      created.push({ ...proposal, status: ProposalStatus.SUBMITTED });
    }

    const phaseIds = schema.phases.map((phase) => phase.id);
    const instanceData = createInstanceDataFromTemplate({ template: schema });
    for (let index = 0; index < phaseIds.indexOf(currentPhaseId); index++) {
      const fromPhaseId = phaseIds[index];
      const toPhaseId = phaseIds[index + 1];
      if (!fromPhaseId || !toPhaseId) {
        throw new Error(`No phase to advance into after ${fromPhaseId}`);
      }
      const result = await db.transaction((tx) =>
        advancePhase({
          db: tx,
          instance: { id: instance.id, instanceData },
          fromPhaseId,
          toPhaseId,
          triggeredByProfileId: null,
        }),
      );
      if (result.conflict) {
        throw new Error(
          `Could not advance ${instance.id} from ${fromPhaseId} to ${toPhaseId}`,
        );
      }
    }

    return {
      instanceId: instance.id,
      instanceProfileId: profileId,
      slug,
      proposals: created,
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

  async makePublic(
    instanceProfileId: string,
    { vote = true }: { vote?: boolean } = {},
  ) {
    await makeDecisionPublic({
      profileId: instanceProfileId,
      permissionBits:
        PERMISSIONS.READ |
        DECISION_BITS.SUBMIT_PROPOSALS |
        (vote ? DECISION_BITS.VOTE : 0),
    });
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
      const { error } = await this.admin.auth.admin.deleteUser(authUserId);
      if (error && error.code !== 'user_not_found') {
        throw new Error(
          `Failed to delete email user ${authUserId}: ${error.message}`,
        );
      }
      if (row?.profileId) {
        await db.delete(profiles).where(eq(profiles.id, row.profileId));
      }
    }
  }
}
