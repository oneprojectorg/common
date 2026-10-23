import { mockCollab } from '@op/collab/testing';
import {
  type DecisionSchemaDefinition,
  type PhoneNumber,
  type VoterEnrolmentRule,
} from '@op/common';
import {
  createDecisionChatLine,
  createDecisionInstance,
  createDecisionProcess,
  createProposal,
  grantDecisionProfileAccess,
  makeDecisionPublic,
  readProfileIdForAuthUser,
} from '@op/common/testing/data';
import {
  TestPhoneAuthDataManager,
  advanceInstancePhase,
} from '@op/common/testing/helpers';
import { db, inArray } from '@op/db/client';
import { ProposalStatus, profiles } from '@op/db/schema';

type RegisterCleanup = (fn: () => void | Promise<void>) => void;

interface FixtureAccount {
  authUserId: string;
  profileId: string;
  email: string | null;
}

interface FixtureProposal {
  title: string;
  budget?: number;
}

const VOTING_PHASE_ID = 'voting';

const votingSchema: DecisionSchemaDefinition = {
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
      selectionPipeline: { version: '1.0.0', blocks: [] },
    },
    {
      id: VOTING_PHASE_ID,
      name: 'Voting',
      rules: {
        proposals: { submit: false },
        voting: { submit: true, maxVotesPerMember: 1 },
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
};

export interface FixtureVotingRules {
  enrolment?: VoterEnrolmentRule;
  edit?: boolean;
  voterBudget?: number;
  maxVotesPerMember?: number;
  ranked?: boolean;
}

const withVotingRules = (
  schema: DecisionSchemaDefinition,
  rules: FixtureVotingRules,
): DecisionSchemaDefinition => {
  const withRule = (phase: DecisionSchemaDefinition['phases'][number]) =>
    phase.id === VOTING_PHASE_ID
      ? {
          ...phase,
          rules: {
            ...phase.rules,
            voting: { ...phase.rules?.voting, ...rules },
          },
        }
      : phase;
  const [first, ...rest] = schema.phases;
  return { ...schema, phases: [withRule(first), ...rest.map(withRule)] };
};

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
    proposalTitles,
    name,
    currentPhaseId = VOTING_PHASE_ID,
    enrolment,
    votingRules,
  }: {
    owner: FixtureAccount;
    proposalTitles: Array<string | FixtureProposal>;
    name?: string;
    currentPhaseId?: string;
    enrolment?: VoterEnrolmentRule;
    votingRules?: FixtureVotingRules;
  }) {
    const rules = { ...votingRules, ...(enrolment ? { enrolment } : {}) };
    const schema =
      Object.keys(rules).length > 0
        ? withVotingRules(votingSchema, rules)
        : votingSchema;
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

    for (const entry of proposalTitles) {
      const { title, budget } =
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
        },
      });
      this.profileIds.push(proposal.profileId);
      const { collaborationDocId } = proposal.proposalData as {
        collaborationDocId?: string;
      };
      if (collaborationDocId) {
        mockCollab.setDocFragments(collaborationDocId, {
          title,
          ...(budget === undefined
            ? {}
            : { budget: JSON.stringify({ amount: budget, currency: 'USD' }) }),
        });
      }
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

    return { instanceId: instance.id, instanceProfileId: profileId, slug };
  }

  async bindLine(instanceId: string, phone: PhoneNumber) {
    await createDecisionChatLine({
      processInstanceId: instanceId,
      phoneNumber: phone,
    });
  }

  async makePublic(instanceProfileId: string) {
    await makeDecisionPublic({ profileId: instanceProfileId });
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
