import { db } from '@op/db/client';
import { ProcessStatus } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { getProfileAccessUser } from '../access';
import { assertUserByAuthId } from '../assert';
import { getProposalsForPhase } from './getProposalsForPhase';
import type {
  DecisionInstanceData,
  PhaseInstanceData,
} from './schemas/instanceData';
import {
  aggregateProposalMetrics,
  executeSelectionPipeline,
} from './selectionPipeline';
import type { ExecutionContext } from './selectionPipeline/types';

export interface PreviewPhaseTransitionInput {
  instanceId: string;
  user: User;
}

export interface PreviewPhaseTransitionResult {
  selectedProposalIds: string[];
  fromPhaseId: string;
  toPhaseId: string;
  fromPhaseName: string;
  toPhaseName: string;
}

/**
 * Preview the result of advancing the current phase without actually advancing.
 *
 * Runs the departing phase's selection pipeline against the current proposals
 * and returns which proposals would be selected. Requires admin access.
 */
export async function previewPhaseTransition({
  instanceId,
  user,
}: PreviewPhaseTransitionInput): Promise<PreviewPhaseTransitionResult> {
  const [dbUser, instance] = await Promise.all([
    assertUserByAuthId(user.id),
    db.query.processInstances.findFirst({
      where: { id: instanceId },
    }),
  ]);

  if (!dbUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  if (!instance) {
    throw new NotFoundError('Process instance not found');
  }

  if (!instance.profileId) {
    throw new CommonError(
      'Decision instance does not have an associated profile',
    );
  }

  const profileUser = await getProfileAccessUser({
    user,
    profileId: instance.profileId,
  });

  assertAccess({ decisions: permission.ADMIN }, profileUser?.roles ?? []);

  if (instance.status !== ProcessStatus.PUBLISHED) {
    throw new ValidationError('Instance must be published');
  }

  const instanceData = instance.instanceData as DecisionInstanceData;
  const phases = instanceData.phases;

  if (!phases || phases.length === 0) {
    throw new CommonError('Instance has no phases defined');
  }

  const fromPhaseId = instance.currentStateId;

  if (!fromPhaseId) {
    throw new CommonError('Instance has no current phase set');
  }

  const currentPhaseIndex = phases.findIndex(
    (p: PhaseInstanceData) => p.phaseId === fromPhaseId,
  );

  if (currentPhaseIndex === -1) {
    throw new CommonError('Current phase not found in instance phases');
  }

  if (currentPhaseIndex === phases.length - 1) {
    throw new ValidationError('Already on final phase');
  }

  const departingPhase = phases[currentPhaseIndex]!;
  const nextPhase = phases[currentPhaseIndex + 1]!;
  const toPhaseId = nextPhase.phaseId;

  const allProposals = await getProposalsForPhase({ instanceId });

  let selectedProposalIds: string[] = allProposals.map((p) => p.id);

  const selectionPipeline = departingPhase.selectionPipeline;

  if (selectionPipeline) {
    const proposalMetrics = await aggregateProposalMetrics(allProposals);
    const context: ExecutionContext = {
      proposals: allProposals,
      voteData: proposalMetrics,
      variables: {},
      outputs: {},
    };
    const selected = await executeSelectionPipeline(selectionPipeline, context);
    selectedProposalIds = selected.map((p) => p.id);
  }

  return {
    selectedProposalIds,
    fromPhaseId,
    toPhaseId,
    fromPhaseName: departingPhase.name ?? fromPhaseId,
    toPhaseName: nextPhase.name ?? toPhaseId,
  };
}
