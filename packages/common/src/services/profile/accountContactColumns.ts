import {
  type Column,
  type GetColumnData,
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
  email: SQL<GetColumnData<typeof authUsers.email>>;
  phone: SQL<GetColumnData<typeof authUsers.phone>>;
} {
  const ownerColumn = <OwnerColumn extends Column>(
    column: OwnerColumn,
  ): SQL<GetColumnData<OwnerColumn>> => {
    const subquery = db
      .select({ value: sql`${column}` })
      .from(ownerUsers)
      .innerJoin(ownerAuthUsers, eq(ownerAuthUsers.id, ownerUsers.authUserId))
      .where(eq(ownerUsers.profileId, profileId))
      .orderBy(asc(ownerUsers.createdAt), asc(ownerUsers.id))
      .limit(1);

    return sql<GetColumnData<OwnerColumn>>`(${subquery})`;
  };

  return {
    email: ownerColumn(ownerAuthUsers.email),
    phone: ownerColumn(ownerAuthUsers.phone),
  };
}

/**
 * The `db.query` form of the same lookup: spread into a `profiles` query's
 * `with`, then map `row.account?.authUser` through `toAccountContact`.
 */
export const withAccountContact = {
  account: {
    columns: {},
    orderBy: { createdAt: 'asc', id: 'asc' },
    with: { authUser: { columns: { email: true, phone: true } } },
  },
} as const;
