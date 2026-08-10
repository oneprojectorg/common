import { set } from '@op/cache';
import { db, eq } from '@op/db/client';
import { organizations, processInstances } from '@op/db/schema';
import { Events, type ProposalExportFilters, event } from '@op/events';
import { User } from '@op/supabase/lib';
import { permission } from 'access-zones';
import { randomUUID } from 'crypto';

import { NotFoundError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { EXPORT_CACHE_TTL_SECONDS, exportStatusCacheKey } from './exports';
import type { ListProposalsInput } from './listProposals';

/**
 * The export filters, constrained to filters `listProposals` can actually
 * apply.
 *
 * An export is only trustworthy if it reproduces the list query it was launched
 * from, and that previously drifted: the request carried a UI-level filter the
 * workflow had no way to apply, so it was dropped on the floor. Naming a filter
 * the list query does not accept now fails to compile rather than silently
 * widening the exported file.
 */
type AppliedExportFilters = ProposalExportFilters &
  Pick<ListProposalsInput, keyof ProposalExportFilters>;

export interface ExportProposalsInput extends ProposalExportFilters {
  processInstanceId: string;
  format: 'csv';
}

export const exportProposals = async ({
  input,
  user,
}: {
  input: ExportProposalsInput;
  user: User;
}): Promise<{ exportId: string; organizationId: string }> => {
  const { processInstanceId } = input;

  // Get process instance with profile and org info
  const result = await db
    .select({
      profileId: processInstances.profileId,
      organizationId: organizations.id,
    })
    .from(processInstances)
    .innerJoin(
      organizations,
      eq(organizations.profileId, processInstances.ownerProfileId),
    )
    .where(eq(processInstances.id, processInstanceId))
    .limit(1);

  if (!result[0]) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  if (!result[0].profileId) {
    throw new NotFoundError('Decision profile', processInstanceId);
  }

  // Check user permissions via profile
  await assertProfileAccess({
    user,
    profileId: result[0].profileId,
    permissions: [{ decisions: permission.ADMIN }],
  });

  const exportId = randomUUID();

  const filters = {
    categoryId: input.categoryId,
    submittedByProfileId: input.submittedByProfileId,
    votedByProfileId: input.votedByProfileId,
    status: input.status,
    dir: input.dir,
    phase: input.phase,
    excludeAssignedForReview: input.excludeAssignedForReview,
  } satisfies AppliedExportFilters;

  // Seed the full status record — not just the id and state — so the frontend
  // can poll immediately and read the same shape it gets once the workflow
  // takes over. A partial seed would answer the first poll with a record
  // missing `format`/`filters`, which no longer satisfies the status contract.
  await set(
    exportStatusCacheKey(exportId),
    {
      exportId,
      processInstanceId: input.processInstanceId,
      userId: user.id,
      format: input.format,
      filters,
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
    EXPORT_CACHE_TTL_SECONDS,
  );

  // Trigger workflow
  await event.send({
    name: Events.proposalExportRequested.name,
    data: {
      exportId,
      processInstanceId: input.processInstanceId,
      userId: user.id,
      format: input.format,
      filters,
    },
  });

  return {
    exportId,
    organizationId: result[0].organizationId,
  };
};
