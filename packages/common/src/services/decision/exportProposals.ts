import { db } from '@op/db/client';
import { proposalExports } from '@op/db/schema';
import { Events, event } from '@op/events';
import { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { CommonError, NotFoundError } from '../../utils';
import { assertProfileAccess } from '../assert';

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
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: { profileId: true },
  });

  if (!instance) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  const { profileId } = instance;

  if (!profileId) {
    throw new NotFoundError('Decision profile', processInstanceId);
  }

  // Check user permissions via profile
  await assertProfileAccess({
    user,
    profileId,
    permissions: [{ decisions: permission.ADMIN }],
  });

  // The row is the durable record of who requested this export and for what
  // — its id becomes the exportId, so the workflow and the first status read
  // both address the same row. `status` defaults to `pending` in the schema.
  const [record] = await db
    .insert(proposalExports)
    .values({
      processInstanceId: input.processInstanceId,
      requestedByUserId: user.id,
      format: input.format,
    })
    .returning({ id: proposalExports.id });

  if (!record) {
    throw new CommonError('Failed to create export record');
  }

  const { id: exportId } = record;

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
