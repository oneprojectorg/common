import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import type { z } from 'zod';

import { NotFoundError } from '../../utils';
import { assertProposalAdmin, resolveAdvancement } from './proposalAdvancement';
import type { proposalAdvanceTargetSchema } from './schemas/advanceProposal';

type ProposalAdvanceTarget = z.infer<typeof proposalAdvanceTargetSchema>;

/**
 * The phase an admin can advance this proposal into, or a `null` target when
 * the "Advance to [phase]" action doesn't apply — see `resolveAdvancement`.
 */
export async function getProposalAdvanceTarget({
  proposalId,
  user,
}: {
  proposalId: string;
  user: User;
}): Promise<{
  processInstanceId: string;
  target: ProposalAdvanceTarget | null;
}> {
  const processInstanceId = await assertProposalAdmin({ proposalId, user });

  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: { currentStateId: true, status: true, instanceData: true },
  });

  if (!instance) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  const advancement = await resolveAdvancement({
    dbClient: db,
    instance: { id: processInstanceId, ...instance },
    proposalId,
  });

  if (!advancement.ok) {
    return { processInstanceId, target: null };
  }

  const { phaseId, name } = advancement.currentPhase;
  return { processInstanceId, target: { phaseId, phaseName: name ?? phaseId } };
}
