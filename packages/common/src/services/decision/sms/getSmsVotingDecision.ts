import { db } from '@op/db/client';
import { ProcessStatus } from '@op/db/schema';
import { permission } from 'access-zones';

import { NotFoundError } from '../../../utils';
import { assertProfileAccess } from '../../assert';
import { formatUnitAmount, getFieldUnit } from '../fieldUnit';
import { getDecisionBySlug } from '../getDecisionBySlug';
import { resolveProposalTemplate } from '../resolveProposalTemplate';
import { getInstancePhases } from '../schemas/instanceData';
import type { VoterEnrolmentRule } from '../schemas/types';
import { getInstanceCurrentPhase } from '../utils/instance';
import {
  getVoterBudget,
  getVoterCostField,
  getVoterEnrolment,
  isVotingPhase,
} from '../utils/phaseSettings';

export interface SmsVotingDecision {
  instanceId: string;
  name: string;
  votingOpen: boolean;
  enrolment: Required<VoterEnrolmentRule> | null;
  budget: string | null;
}

interface VotingInstance {
  id: string;
  instanceData: unknown;
  currentStateId: string | null;
  processId: string | null;
}

const summarizeVotingInstance = async (
  name: string,
  instance: VotingInstance,
): Promise<SmsVotingDecision> => {
  const phase = getInstanceCurrentPhase({
    currentStateId: instance.currentStateId,
    instanceData: { phases: getInstancePhases(instance.instanceData) },
  });
  const voterBudget = phase ? getVoterBudget(phase) : undefined;
  const template =
    phase && voterBudget !== undefined
      ? await resolveProposalTemplate(instance.instanceData, instance.processId)
      : null;
  const unit =
    phase && template
      ? getFieldUnit(template.properties?.[getVoterCostField(phase)])
      : undefined;

  return {
    instanceId: instance.id,
    name,
    votingOpen: phase ? isVotingPhase(phase) : false,
    enrolment: (phase && getVoterEnrolment(phase)) ?? null,
    budget:
      voterBudget !== undefined && unit
        ? formatUnitAmount({ amount: voterBudget, unit })
        : null,
  };
};

export async function getSmsVotingDecision({
  authUserId,
  decisionSlug,
}: {
  authUserId: string;
  decisionSlug: string;
}): Promise<SmsVotingDecision> {
  const { name, processInstance } = await getDecisionBySlug({
    user: { id: authUserId },
    slug: decisionSlug,
  });

  if (processInstance.status !== ProcessStatus.PUBLISHED) {
    throw new NotFoundError('Decision', decisionSlug);
  }

  return summarizeVotingInstance(name, processInstance);
}

export async function describeEnrolmentDecision({
  instanceId,
  authUserId,
}: {
  instanceId: string;
  authUserId: string;
}): Promise<SmsVotingDecision> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    columns: {
      id: true,
      instanceData: true,
      currentStateId: true,
      processId: true,
    },
    with: { profile: { columns: { id: true, name: true } } },
  });

  if (!instance?.profile) {
    throw new NotFoundError('Process instance', instanceId);
  }

  await assertProfileAccess({
    user: { id: authUserId },
    profileId: instance.profile.id,
    permissions: [
      { decisions: permission.ADMIN },
      { decisions: permission.READ },
    ],
    notMemberMessage: 'User does not have access to this process',
  });

  return summarizeVotingInstance(instance.profile.name, instance);
}
