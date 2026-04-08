import { and, db, desc, eq, inArray, isNull, sql } from '@op/db/client';
import {
  ProcessStatus,
  decisionProcessTransitions,
  decisionTransitionProposals,
  processInstances,
  proposalHistory,
  stateTransitionHistory,
} from '@op/db/schema';
import type { DecisionProcess } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import {
  CommonError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { getProfileAccessUser } from '../access';
import { assertUserByAuthId } from '../assert';
import { getProposalsForPhase } from './getProposalsForPhase';
import { processResults } from './processResults';
import type { DecisionInstanceData } from './schemas/instanceData';
import { aggregateVoteData, executePipeline } from './selectionPipeline';
import type {
  ExecutionContext,
  SelectionPipeline,
} from './selectionPipeline/types';
import type { InstanceData, ProcessSchema } from './types';

export interface ManualTransitionInput {
  instanceId: string;
  user: User;
  /**
   * The phase the caller observed as current. If provided, the transition only
   * proceeds when the instance is actually on this phase. If the instance has
   * already moved on (e.g. concurrent admin click, retry of a stale request),
   * a ConflictError is thrown so the caller can refetch and re-decide.
   */
  currentPhaseId?: string;
}

export interface ManualTransitionResult {
  instanceId: string;
  currentPhaseId: string;
  previousPhaseId: string;
}

/**
 * Manually advance a decision instance from its current phase to the next phase.
 * Validates admin access, instance eligibility, and executes the transition atomically.
 *
 * On every transition: runs the departing phase's selection pipeline (if defined)
 * and persists surviving proposals into the transition join table — matching the
 * TransitionEngine's behavior.
 *
 * On the final phase: additionally runs processResults to store final selections
 * in the results tables and update proposal statuses.
 */
export async function manualTransition({
  instanceId,
  user,
  currentPhaseId: expectedFromPhaseId,
}: ManualTransitionInput): Promise<ManualTransitionResult> {
  const dbUser = await assertUserByAuthId(user.id);

  if (!dbUser.currentProfileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  // Fetch the instance with its process definition
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    with: { process: true },
  });

  if (!instance) {
    throw new NotFoundError('Process instance not found');
  }

  // Validate admin access
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

  // Validate instance is eligible for transition
  if (instance.status !== ProcessStatus.PUBLISHED) {
    throw new ValidationError('Instance must be published');
  }

  const instanceData = instance.instanceData as DecisionInstanceData;
  const phases = instanceData.phases;

  if (!phases || phases.length === 0) {
    throw new CommonError('Instance has no phases defined');
  }

  const fromPhaseId = instanceData.currentPhaseId;

  if (!fromPhaseId) {
    throw new CommonError('Instance has no current phase set');
  }

  // Strict idempotency check: if the caller told us which phase they observed,
  // refuse to advance unless the instance is still on that phase. This prevents
  // double-clicks and stale retries from advancing through multiple phases.
  if (expectedFromPhaseId && expectedFromPhaseId !== fromPhaseId) {
    throw new ConflictError(
      `Instance is on phase '${fromPhaseId}', not '${expectedFromPhaseId}'`,
    );
  }

  const currentPhaseIndex = phases.findIndex(
    (p) => p.phaseId === fromPhaseId,
  );

  if (currentPhaseIndex === -1) {
    throw new CommonError('Current phase not found in instance phases');
  }

  if (currentPhaseIndex === phases.length - 1) {
    throw new ValidationError('Already on final phase');
  }

  const nextPhase = phases[currentPhaseIndex + 1]!;
  const nextPhaseId = nextPhase.phaseId;
  const isTransitioningToFinalPhase =
    currentPhaseIndex + 1 === phases.length - 1;
  const now = new Date().toISOString();

  // Resolve the departing phase's selection pipeline from the process schema
  const process = instance.process as DecisionProcess;
  const processSchema = process?.processSchema as ProcessSchema | undefined;
  const selectionPipeline: SelectionPipeline | undefined =
    processSchema?.phases?.find(
      (p) => p.id === fromPhaseId,
    )?.selectionPipeline;

  // Execute transition atomically.
  // Selection pipeline + proposal persistence run inside the transaction
  // so reads and writes are from a consistent snapshot.
  await db.transaction(async (tx) => {
    // Fetch proposals visible in the current phase as the default surviving set
    const allProposals = await getProposalsForPhase({
      instanceId,
      dbClient: tx,
    });

    let survivingProposalIds: string[] = allProposals.map((p) => p.id);

    // If the departing phase has a selection pipeline, run it to narrow the surviving set
    if (selectionPipeline) {
      const voteData = await aggregateVoteData(allProposals, tx);
      const context: ExecutionContext = {
        proposals: allProposals,
        voteData,
        process: {
          instanceId,
          processId: instance.processId!,
          currentStateId: instance.currentStateId,
          instanceData: instanceData as unknown as InstanceData,
          processSchema: processSchema!,
          processInstance: instance,
        },
        variables: {},
        outputs: {},
      };
      const surviving = await executePipeline(selectionPipeline, context);
      survivingProposalIds = surviving.map((p) => p.id);
    }

    if (survivingProposalIds.length === 0 && allProposals.length > 0) {
      console.warn('Manual transition produced zero surviving proposals', {
        instanceId,
        fromStateId: fromPhaseId,
        toStateId: nextPhaseId,
      });
    }

    // Update instance state with optimistic lock on currentStateId
    // to prevent concurrent transitions from double-advancing.
    // Uses jsonb_set to update instanceData server-side so the write
    // operates on the current DB value, avoiding TOCTOU races.
    const updated = await tx
      .update(processInstances)
      .set({
        currentStateId: nextPhaseId,
        updatedAt: now,
        instanceData: sql`jsonb_set(
          jsonb_set(
            jsonb_set(
              coalesce(${processInstances.instanceData}, '{}'::jsonb),
              '{currentPhaseId}',
              to_jsonb(${nextPhaseId}::text)
            ),
            '{stateData}',
            coalesce(${processInstances.instanceData}->'stateData', '{}'::jsonb)
          ),
          array['stateData', ${nextPhaseId}]::text[],
          ${JSON.stringify({ enteredAt: now, metadata: { manual: true } })}::jsonb
        )`,
      })
      .where(
        and(
          eq(processInstances.id, instanceId),
          eq(processInstances.currentStateId, fromPhaseId),
          eq(processInstances.status, ProcessStatus.PUBLISHED),
        ),
      )
      .returning({ id: processInstances.id });

    if (updated.length === 0) {
      throw new CommonError(
        'Phase was already advanced, or instance is no longer published',
      );
    }

    // Mark any pending scheduled transition for the current phase as completed
    await tx
      .update(decisionProcessTransitions)
      .set({ completedAt: now })
      .where(
        and(
          eq(decisionProcessTransitions.processInstanceId, instanceId),
          eq(decisionProcessTransitions.fromStateId, fromPhaseId),
          isNull(decisionProcessTransitions.completedAt),
        ),
      );

    // Record transition history and get the inserted ID
    const [insertedTransition] = await tx
      .insert(stateTransitionHistory)
      .values({
        processInstanceId: instanceId,
        fromStateId: fromPhaseId,
        toStateId: nextPhaseId,
        transitionData: { manual: true },
        triggeredByProfileId: dbUser.currentProfileId,
      })
      .returning({ id: stateTransitionHistory.id });

    // Persist surviving proposals into the join table
    if (!insertedTransition) {
      throw new Error(
        `stateTransitionHistory insert returned no ID for instance ${instanceId}`,
      );
    }

    if (survivingProposalIds.length > 0) {
      const latestHistoryRows = await tx
        .selectDistinctOn([proposalHistory.id], {
          proposalId: proposalHistory.id,
          historyId: proposalHistory.historyId,
        })
        .from(proposalHistory)
        .where(
          and(
            eq(proposalHistory.processInstanceId, instanceId),
            inArray(proposalHistory.id, survivingProposalIds),
          ),
        )
        .orderBy(proposalHistory.id, desc(proposalHistory.historyCreatedAt));

      if (latestHistoryRows.length !== survivingProposalIds.length) {
        throw new Error(
          `Proposals missing history records during manual transition for instance ${instanceId}: expected ${survivingProposalIds.length}, got ${latestHistoryRows.length}`,
        );
      }

      await tx.insert(decisionTransitionProposals).values(
        latestHistoryRows.map(({ proposalId, historyId }) => ({
          processInstanceId: instanceId,
          transitionHistoryId: insertedTransition.id,
          proposalId,
          proposalHistoryId: historyId,
        })),
      );
    }
  });

  // Process final results when transitioning to the final phase.
  // This stores selections in decisionProcessResults / decisionProcessResultSelections
  // and updates proposal statuses — separate from the per-transition join table above.
  if (isTransitioningToFinalPhase) {
    try {
      await processResults({ processInstanceId: instanceId });
    } catch (err) {
      console.error(
        `processResults failed for instance ${instanceId} after manual transition to final phase:`,
        err,
      );
    }
  }

  return {
    instanceId,
    currentPhaseId: nextPhaseId,
    previousPhaseId: fromPhaseId,
  };
}
