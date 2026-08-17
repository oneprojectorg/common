import { set } from '@op/cache';
import { db, eq } from '@op/db/client';
import { processInstances } from '@op/db/schema';
import { Events, event } from '@op/events';
import { User } from '@op/supabase/lib';
import { permission } from 'access-zones';
import { randomUUID } from 'crypto';

import { NotFoundError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { EXPORT_CACHE_TTL_SECONDS, exportStatusCacheKey } from './exports';

export interface ExportProposalsInput {
  processInstanceId: string;
  format: 'csv';
}

export const exportProposals = async ({
  input,
  user,
}: {
  input: ExportProposalsInput;
  user: User;
}): Promise<{ exportId: string }> => {
  const { processInstanceId } = input;

  // Resolve the decision profile the export belongs to. Authorization hangs off
  // this profile; there is no organization lookup because exports are written
  // to the shared `assets` bucket and no longer need an owning org.
  //
  // Deferred: joining `profiles` would make the null-profileId branch below
  // unrepresentable, but it also collapses "no such instance" and "instance has
  // no profile" into one indistinguishable miss. Kept as two lookups until we
  // decide which error those callers should see.
  const result = await db
    .select({
      profileId: processInstances.profileId,
    })
    .from(processInstances)
    .where(eq(processInstances.id, processInstanceId))
    .limit(1);

  if (!result[0]) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  const { profileId } = result[0];

  if (!profileId) {
    throw new NotFoundError('Decision profile', processInstanceId);
  }

  // Check user permissions via profile
  await assertProfileAccess({
    user,
    profileId,
    permissions: [{ decisions: permission.ADMIN }],
  });

  const exportId = randomUUID();

  // Seeded in full rather than as an id and a state: the status contract
  // requires `format`, so a partial record fails the first read instead of
  // answering it. This cache is the only store of export state — no table
  // stands behind it — so nothing else can supply what the seed omits.
  await set(
    exportStatusCacheKey(exportId),
    {
      exportId,
      processInstanceId: input.processInstanceId,
      userId: user.id,
      format: input.format,
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
    },
  });

  return {
    exportId,
  };
};
