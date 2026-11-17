import { and, db } from '@op/db/client';

import { ValidationError } from '../../utils';
import {
  activeProposalPredicate,
  phaseEligiblePredicate,
} from './phaseEligibility';

/**
 * Every source must be a live, submitted, not rejected, not merged proposal of
 * this instance. Sources may come from any phase.
 */
export async function assertDevelopSources({
  instance,
  sourceProposalIds,
}: {
  instance: { id: string };
  sourceProposalIds: string[];
}): Promise<void> {
  if (sourceProposalIds.length === 0) {
    throw new ValidationError('Choose at least one source proposal');
  }

  const validRows = await db.query.proposals.findMany({
    where: {
      id: { in: sourceProposalIds },
      processInstanceId: instance.id,
      RAW: (table) =>
        and(phaseEligiblePredicate(table), activeProposalPredicate(table))!,
    },
    columns: { id: true },
  });

  const validIds = new Set(validRows.map((row) => row.id));
  const invalidIds = sourceProposalIds.filter((id) => !validIds.has(id));

  if (invalidIds.length > 0) {
    throw new ValidationError(
      `These proposals cannot be developed: ${invalidIds.join(', ')}`,
    );
  }
}
