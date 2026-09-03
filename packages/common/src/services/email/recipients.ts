import { and, db, eq } from '@op/db/client';
import {
  accessRoles,
  authUsers,
  organizationUserToAccessRoles,
  organizationUsers,
  profileUsers,
  users,
} from '@op/db/schema';
import { alias, union } from 'drizzle-orm/pg-core';

/**
 * `public.users` and `auth.users` are both named `users`, so a query that
 * joins the two must alias one of them or Postgres rejects the reference as
 * ambiguous.
 */
const account = alias(authUsers, 'account');

export type EmailRecipient = {
  authUserId: string;
  /** Null for anonymous accounts, which carry no address in auth.users. */
  email: string | null;
};

/**
 * The only delivery address we have is `auth.users.email` — the sign-in
 * address Supabase keeps current. **No sender may read an email column
 * directly.** Every other `email` column in the schema is either a snapshot
 * with no working sync (`profile_users.email`, `public.users.email`) or a
 * public contact field the person typed and we never verified
 * (`profiles.email`, the org contact address). Addresses come from the
 * resolvers below, and a recipient list is keyed on `authUserId` so the
 * dedupe and any exclusion are identity comparisons rather than string
 * comparisons across two different columns.
 *
 * Each resolver is one primary-key join onto `auth.users` over a member list
 * of tens to hundreds of rows, so it costs nothing measurable per
 * notification. If a sender cannot use one of these cleanly, write the same
 * join inline there rather than reading a snapshot column.
 */

/**
 * Everyone reachable through a profile: the person an individual profile
 * belongs to, plus every member row on a profile that has a members panel
 * (organization, process, proposal). Both paths, unioned, because a profile
 * id on its own does not say which shape it is — a vote's submitter and a
 * proposal's collaborators arrive at this helper the same way.
 */
export async function listProfileRecipients({
  profileId,
}: {
  profileId: string;
}): Promise<Array<EmailRecipient>> {
  const owner = db
    .select({ authUserId: users.authUserId, email: account.email })
    .from(users)
    .innerJoin(account, eq(account.id, users.authUserId))
    .where(eq(users.profileId, profileId));

  const members = db
    .select({ authUserId: profileUsers.authUserId, email: account.email })
    .from(profileUsers)
    .innerJoin(account, eq(account.id, profileUsers.authUserId))
    .where(eq(profileUsers.profileId, profileId));

  // With the address sourced per authUserId, UNION's row dedupe *is* the
  // identity dedupe: one person cannot surface under two addresses.
  return union(owner, members);
}

/**
 * The account behind one `users` row. Only the moderation notifier needs
 * this shape: it is handed a `users.id` rather than a profile.
 */
export async function listUserRecipient({
  userId,
}: {
  userId: string;
}): Promise<EmailRecipient | null> {
  const [recipient] = await db
    .select({ authUserId: users.authUserId, email: account.email })
    .from(users)
    .innerJoin(account, eq(account.id, users.authUserId))
    .where(eq(users.id, userId))
    .limit(1);

  return recipient ?? null;
}

/**
 * Admins of an organization. The audience for mail addressed to an org that
 * has no individual author to reach — the org's own contact address is a
 * public field, not an account we may deliver to.
 */
export async function listOrganizationAdminRecipients({
  organizationId,
}: {
  organizationId: string;
}): Promise<Array<EmailRecipient>> {
  return db
    .selectDistinct({
      authUserId: organizationUsers.authUserId,
      email: account.email,
    })
    .from(organizationUsers)
    .innerJoin(account, eq(account.id, organizationUsers.authUserId))
    .innerJoin(
      organizationUserToAccessRoles,
      eq(
        organizationUserToAccessRoles.organizationUserId,
        organizationUsers.id,
      ),
    )
    .innerJoin(
      accessRoles,
      eq(accessRoles.id, organizationUserToAccessRoles.accessRoleId),
    )
    .where(
      and(
        eq(organizationUsers.organizationId, organizationId),
        eq(accessRoles.name, 'Admin'),
      ),
    );
}
