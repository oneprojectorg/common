import { type DecisionSchemaDefinition, type PhoneNumber } from '@op/common';
import {
  createDecisionInstance,
  createDecisionProcess,
  createProposal,
  grantDecisionProfileAccess,
  readProfileIdForAuthUser,
} from '@op/common/testing/data';
import {
  TestPhoneAuthDataManager,
  advanceInstancePhase,
} from '@op/common/testing/helpers';
import { db, inArray } from '@op/db/client';
import { ProposalStatus, profiles } from '@op/db/schema';

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

export class SmsCommandFixture {
  private readonly phoneAuth: TestPhoneAuthDataManager;
  private readonly profileIds: string[] = [];

  constructor(testId: string, onTestFinished: RegisterCleanup) {
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
      profileId: await readProfileIdForAuthUser(authUserId),
      email: null,
    };
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
    proposalTitles: Array<string | FixtureProposal>;
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

    const created = [];
    for (const entry of proposalTitles) {
      const { title, budget, summary, leftBehind } =
        typeof entry === 'string' ? { title: entry } : entry;
      const proposal = await createProposal({
        processInstanceId: instance.id,
        submittedByProfileId: owner.profileId,
        status: ProposalStatus.SUBMITTED,
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
      created.push(proposal);
    }

    const phaseIds = schema.phases.map((phase) => phase.id);
    for (let index = 0; index < phaseIds.indexOf(currentPhaseId); index++) {
      const fromPhaseId = phaseIds[index];
      const toPhaseId = phaseIds[index + 1];
      if (!fromPhaseId || !toPhaseId) {
        throw new Error(`No phase to advance into after ${fromPhaseId}`);
      }
      const result = await advanceInstancePhase({
        instanceId: instance.id,
        fromPhaseId,
        toPhaseId,
      });
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

  private async cleanup() {
    if (this.profileIds.length > 0) {
      await db.delete(profiles).where(inArray(profiles.id, this.profileIds));
    }
  }
}
