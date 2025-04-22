import type { User } from '@op/supabase/lib';

import { db, and } from '@op/db/client';

// gets a user assuming that the user is authenticated
export const getOrgAccessUser = async ({
  user,
  organizationId,
}: {
  user: User;
  organizationId: string;
}) => {
  const orgUser = await db.query.organizationUsers.findFirst({
    where: (table, { eq }) =>
      and(
        eq(table.organizationId, organizationId),
        eq(table.authUserId, user.id),
      ),
    with: { roles: true },
  });

  return orgUser;
};
