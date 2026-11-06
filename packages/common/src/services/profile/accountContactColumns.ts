import {
  type SQL,
  type SQLWrapper,
  aliasedTable,
  asc,
  db,
  eq,
  sql,
} from '@op/db/client';
import { authUsers, users } from '@op/db/schema';

const ownerUsers = aliasedTable(users, 'owner_users');
const ownerAuthUsers = aliasedTable(authUsers, 'owner_auth_users');

/**
 * The raw `auth.users` email and phone of the account that owns a profile, as
 * SQL expressions for aggregate `db.select` statements that search or group on
 * them. `db.query` callers use the `profiles.account` relation instead, and
 * order it the same way: `created_at`, then `id`, first row.
 */
export function accountContactColumns(profileId: SQLWrapper): {
  email: SQL<string | null>;
  phone: SQL<string | null>;
} {
  const ownerColumn = (column: SQLWrapper): SQL<string | null> => {
    const subquery = db
      .select({ value: sql`${column}` })
      .from(ownerUsers)
      .innerJoin(ownerAuthUsers, eq(ownerAuthUsers.id, ownerUsers.authUserId))
      .where(eq(ownerUsers.profileId, profileId))
      .orderBy(asc(ownerUsers.createdAt), asc(ownerUsers.id))
      .limit(1);

    return sql<string | null>`(${subquery})`;
  };

  return {
    email: ownerColumn(ownerAuthUsers.email),
    phone: ownerColumn(ownerAuthUsers.phone),
  };
}
