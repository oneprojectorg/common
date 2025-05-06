import { db } from '@op/db/client';
import { organizationRelationships } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { UnauthorizedError } from '../../utils';
import { getOrgAccessUser } from '../access';

export const addRelationship = async ({
  user,
  from,
  to,
}: {
  user: User;
  from: string;
  to: string;
}) => {
  // const orgUser = await getOrgAccessUser({ user, organizationId: from });

  // TODO: ALL USERS IN THE ORG ARE ADMIN AT THE MOMENT
  // assertAccess();

  // if (!orgUser) {
  // throw new UnauthorizedError('You are not a member of this organization');
  // }

  await db
    .insert(organizationRelationships)
    .values({
      sourceOrganizationId: from,
      targetOrganizationId: to,
      relationshipType: 'relation',
    })
    .onConflictDoNothing();
};
