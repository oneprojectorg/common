import { mockCollab } from '@op/collab/testing';
import {
  type DecisionSchemaDefinition,
  type PhoneNumber,
  type VoterEnrolmentRule,
  deleteProposal,
  getInstancePhases,
  updateDecisionInstance,
} from '@op/common';
import {
  createDecisionBoundary,
  createDecisionPhoneNumber,
  createDecisionInstance,
  createDecisionProcess,
  createProposal,
  ensureProposalCategoryTerms,
  grantDecisionProfileAccess,
  makeDecisionPublic,
  readProfileIdForAuthUser,
} from '@op/common/testing/data';
import {
  TestPhoneAuthDataManager,
  advanceInstancePhase,
} from '@op/common/testing/helpers';
import { db, eq, inArray } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  processInstances,
  profiles,
  taxonomyTerms,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';

type RegisterCleanup = (fn: () => void | Promise<void>) => void;

interface FixtureAccount {
  authUserId: string;
  profileId: string;
  email: string | null;
}

interface FixtureProposal {
  title: string;
  /** A number is a priced budget; a string is written to the document as it is, an unreadable cost. */
  budget?: number | string;
}

const VOTING_PHASE_ID = 'voting';

const userOf = (account: FixtureAccount): User => ({
  id: account.authUserId,
  aud: 'authenticated',
  role: 'authenticated',
  email: account.email ?? undefined,
  phone: undefined,
  app_metadata: {},
  user_metadata: {},
  is_anonymous: false,
});

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
  voterBudget?: number;
  voterCostField?: string;
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
  private readonly termIds: string[] = [];

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
    ownerIsAdmin = false,
  }: {
    owner: FixtureAccount;
    proposalTitles: Array<string | FixtureProposal>;
    name?: string;
    currentPhaseId?: string;
    enrolment?: VoterEnrolmentRule;
    votingRules?: FixtureVotingRules;
    /** Grant the owner the decision's admin role, as the web creator gets; the default leaves them a plain member. */
    ownerIsAdmin?: boolean;
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
      grantAdminAccess: ownerIsAdmin,
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
          ...(typeof budget === 'number'
            ? { budget: { amount: budget, currency: 'USD' } }
            : {}),
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
            : typeof budget === 'string'
              ? { budget }
              : {
                  budget: JSON.stringify({ amount: budget, currency: 'USD' }),
                }),
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

  async closeVoting(instanceId: string) {
    const result = await advanceInstancePhase({
      instanceId,
      fromPhaseId: VOTING_PHASE_ID,
      toPhaseId: 'results',
    });
    if (result.conflict) {
      throw new Error(`Could not close voting on ${instanceId}`);
    }
  }

  async bindLine(instanceId: string, phone: PhoneNumber) {
    await createDecisionPhoneNumber({
      processInstanceId: instanceId,
      phoneNumber: phone,
    });
  }

  async createDistrict({
    profileId,
    name,
  }: {
    profileId: string;
    name: string;
  }) {
    const [term] = await ensureProposalCategoryTerms([name]);
    if (!term) {
      throw new Error(`Failed to ensure a district term for ${name}`);
    }
    this.termIds.push(term.taxonomyTermId);
    return createDecisionBoundary({
      profileId,
      name,
      taxonomyTermId: term.taxonomyTermId,
    });
  }

  async rewriteAttestation({
    instanceId,
    owner,
    phaseId = VOTING_PHASE_ID,
    attestation,
  }: {
    instanceId: string;
    owner: FixtureAccount;
    phaseId?: string;
    attestation: string;
  }) {
    await updateDecisionInstance({
      instanceId,
      phases: [
        {
          phaseId,
          rules: { voting: { submit: true, enrolment: { attestation } } },
        },
      ],
      user: userOf(owner),
    });
  }

  async setStatus({
    instanceId,
    owner,
    status,
  }: {
    instanceId: string;
    owner: FixtureAccount;
    status: ProcessStatus;
  }) {
    await updateDecisionInstance({
      instanceId,
      status,
      user: userOf(owner),
    });
  }

  /** Writes the phase's voting rules straight into instance_data, bypassing the admin validation, to plant a state no service produces. */
  async plantVotingRules({
    instanceId,
    phaseId = VOTING_PHASE_ID,
    voting,
  }: {
    instanceId: string;
    phaseId?: string;
    voting: FixtureVotingRules;
  }) {
    const instance = await db.query.processInstances.findFirst({
      where: { id: instanceId },
      columns: { instanceData: true },
    });
    const phases = getInstancePhases(instance?.instanceData).map((phase) =>
      phase.phaseId === phaseId
        ? {
            ...phase,
            rules: {
              ...phase.rules,
              voting: { ...phase.rules?.voting, ...voting },
            },
          }
        : phase,
    );
    await db
      .update(processInstances)
      .set({
        instanceData: {
          ...(instance?.instanceData as Record<string, unknown>),
          phases,
        },
      })
      .where(eq(processInstances.id, instanceId));
  }

  async deleteProposal({
    instanceId,
    owner,
    code,
  }: {
    instanceId: string;
    owner: FixtureAccount;
    code: number;
  }) {
    const proposal = await db.query.proposals.findFirst({
      where: { processInstanceId: instanceId, shortCode: code },
      columns: { id: true },
    });
    if (!proposal) {
      throw new Error(`No proposal ${code} on ${instanceId}`);
    }
    await deleteProposal({ proposalId: proposal.id, user: userOf(owner) });
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
    if (this.termIds.length > 0) {
      await db
        .delete(taxonomyTerms)
        .where(inArray(taxonomyTerms.id, this.termIds));
    }
  }
}
