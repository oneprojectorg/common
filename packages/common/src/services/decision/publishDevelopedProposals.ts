import { and, db, desc, eq, exists, isNull } from '@op/db/client';
import {
  ProcessStatus,
  ProposalRelationshipType,
  ProposalStatus,
  Visibility,
  decisionTransitionProposals,
  proposalRelationships,
  proposals,
  stateTransitionHistory,
} from '@op/db/schema';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import {
  CommonError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { assertProfileAccess, assertUserByAuthId } from '../assert';
import { isEveryCategoryDevelopConfirmed } from './developLock';
import { getPhases } from './instancePhases';
import { lockProcessInstanceOrThrow } from './lockProcessInstance';
import { activeProposalPredicate } from './phaseEligibility';
import type { PublishDevelopedProposalsResult } from './schemas/developSources';
import type {
  ManualSelectionAudit,
  TransitionData,
} from './schemas/transitionData';
import { sendManualSelectionsConfirmed } from './sendManualSelectionsConfirmed';
import { getPreviousPhases } from './utils/phaseOrder';
import { isDevelopPhase } from './utils/phaseSettings';

/**
 * Publishes the entries of the current develop phase once every category has
 * confirmed its development. The advanced entries (submitted targets of a
 * live `developed` edge) that are hidden become visible, and the inbound
 * transition gets the `manualSelection` stamp that `submitManualSelection`
 * writes, with no proposal attached. That stamp confirms the selections of
 * the phase, which closes the develop window.
 */
export async function publishDevelopedProposals({
  processInstanceId,
  user,
}: {
  processInstanceId: string;
  user: User;
}): Promise<PublishDevelopedProposalsResult> {
  const [dbUser, instance] = await Promise.all([
    assertUserByAuthId(user.id),
    db.query.processInstances.findFirst({
      where: { id: processInstanceId },
      columns: { profileId: true, status: true, currentStateId: true },
    }),
  ]);

  if (!instance) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  if (!instance.profileId) {
    throw new CommonError(
      'Decision instance does not have an associated profile',
    );
  }

  if (!dbUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  if (instance.status !== ProcessStatus.PUBLISHED) {
    throw new ValidationError(
      'Developed proposals can only be published in a published instance',
    );
  }

  const currentStateId = instance.currentStateId;
  if (!currentStateId) {
    throw new ValidationError('Instance has no current phase set');
  }

  const byProfileId = dbUser.profileId;

  const { previousPhaseId, publishedCount } = await db.transaction(
    async (tx) => {
      const lockedInstance = await lockProcessInstanceOrThrow({
        db: tx,
        instanceId: processInstanceId,
      });

      if (
        lockedInstance.status !== ProcessStatus.PUBLISHED ||
        lockedInstance.currentStateId !== currentStateId
      ) {
        throw new ConflictError(
          'Instance has changed since publishing started; refresh and retry',
        );
      }

      const phases = await getPhases({
        instance: {
          id: processInstanceId,
          instanceData: lockedInstance.instanceData,
        },
        db: tx,
      });
      const currentPhase = phases.find(
        (phase) => phase.phaseId === currentStateId,
      );
      const previousPhase = getPreviousPhases({ phases }, currentStateId).at(
        -1,
      );

      if (!currentPhase || !isDevelopPhase(currentPhase) || !previousPhase) {
        throw new ValidationError(
          'Developed proposals can only be published in a develop phase',
        );
      }

      const [latestRow] = await tx
        .select({
          id: stateTransitionHistory.id,
          toStateId: stateTransitionHistory.toStateId,
          transitionData: stateTransitionHistory.transitionData,
          triggeredByProfileId: stateTransitionHistory.triggeredByProfileId,
          selectionConfirmedAt: stateTransitionHistory.selectionConfirmedAt,
        })
        .from(stateTransitionHistory)
        .where(eq(stateTransitionHistory.processInstanceId, processInstanceId))
        .orderBy(desc(stateTransitionHistory.transitionedAt))
        .limit(1)
        .for('update');

      if (!latestRow || latestRow.toStateId !== currentStateId) {
        throw new ConflictError(
          'Instance has changed since publishing started; refresh and retry',
        );
      }

      const existingTransitionData =
        (latestRow.transitionData as TransitionData | null | undefined) ?? {};

      if (existingTransitionData.manualSelection) {
        throw new ConflictError(
          'Developed proposals have already been published for this phase',
        );
      }

      const attached = await tx
        .select({ proposalId: decisionTransitionProposals.proposalId })
        .from(decisionTransitionProposals)
        .where(
          eq(decisionTransitionProposals.transitionHistoryId, latestRow.id),
        )
        .limit(1);

      // A settled selection, or proposals a pipeline attached, confirm the
      // phase already; the attachments cover transitions the previous
      // deployment wrote during the rollout without selectionConfirmedAt.
      if (latestRow.selectionConfirmedAt !== null || attached.length > 0) {
        throw new ValidationError(
          'Developed proposals cannot be published for this phase',
        );
      }

      const everyCategoryConfirmed = await isEveryCategoryDevelopConfirmed({
        processInstanceId,
        phaseId: currentStateId,
        dbClient: tx,
      });

      if (!everyCategoryConfirmed) {
        throw new ValidationError(
          'Every category must confirm its development before publishing',
        );
      }

      const published = await tx
        .update(proposals)
        .set({ visibility: Visibility.VISIBLE })
        .where(
          and(
            eq(proposals.processInstanceId, processInstanceId),
            eq(proposals.status, ProposalStatus.SUBMITTED),
            eq(proposals.visibility, Visibility.HIDDEN),
            activeProposalPredicate(proposals),
            exists(
              tx
                .select({ id: proposalRelationships.id })
                .from(proposalRelationships)
                .where(
                  and(
                    eq(
                      proposalRelationships.processInstanceId,
                      processInstanceId,
                    ),
                    eq(proposalRelationships.targetProposalId, proposals.id),
                    eq(
                      proposalRelationships.relationshipType,
                      ProposalRelationshipType.DEVELOPED,
                    ),
                    isNull(proposalRelationships.deletedAt),
                  ),
                ),
            ),
          ),
        )
        .returning({ id: proposals.id });

      const confirmedAt = new Date();
      const manualSelection: ManualSelectionAudit = {
        byProfileId,
        at: confirmedAt.toISOString(),
      };

      await tx
        .update(stateTransitionHistory)
        .set({
          transitionData: { ...existingTransitionData, manualSelection },
          selectionConfirmedAt: confirmedAt,
          ...(latestRow.triggeredByProfileId == null
            ? { triggeredByProfileId: byProfileId }
            : {}),
        })
        .where(eq(stateTransitionHistory.id, latestRow.id));

      return {
        previousPhaseId: previousPhase.phaseId,
        publishedCount: published.length,
      };
    },
  );

  logger.info('Published developed proposals', {
    processInstanceId,
    phaseId: currentStateId,
    actorProfileId: byProfileId,
    publishedCount,
  });

  sendManualSelectionsConfirmed({
    processInstanceId,
    fromPhaseId: previousPhaseId,
    toPhaseId: currentStateId,
  });

  return { publishedCount };
}
