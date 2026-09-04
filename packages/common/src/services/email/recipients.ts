import { and, db, eq } from '@op/db/client';
import {
  EntityType,
  accessRoles,
  authUsers as authUsersTable,
  organizationUserToAccessRoles,
  organizationUsers,
  organizations,
  profileUsers,
  users,
} from '@op/db/schema';
import { alias } from 'drizzle-orm/pg-core';

/**
 * `public.users` and `auth.users` are both named `users`, so a query that
 * joins the two must alias one of them or Postgres rejects the reference as
 * ambiguous.
 */
const authUsers = alias(authUsersTable, 'auth_users');

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
 * (`profiles.email`, the org contact address). Addresses come from
 * `listProfileRecipients`, and a recipient list is keyed on `authUserId` so
 * the dedupe and any exclusion are identity comparisons rather than string
 * comparisons across two different columns.
 *
 * The three builders below are the only joins onto `auth.users`. They are
 * unexecuted so a caller can `union()` them or add its own joins; each is one
 * primary-key join over a member list of tens to hundreds of rows.
 */

/** The account an individual profile belongs to, via `users.profile_id`. */
export const profileOwnerRecipients = (profileId: string) =>
  db
    .select({ authUserId: users.authUserId, email: authUsers.email })
    .from(users)
    .innerJoin(authUsers, eq(authUsers.id, users.authUserId))
    .where(eq(users.profileId, profileId));

/**
 * Every member on a profile with a members panel, before any filter. The
 * caller adds `.where()` (and any join) so a process audience can reach
 * proposal collaborators through `proposals.profile_id` with the same join.
 * Distinct because one person can hold two member rows written at different
 * times; with the address sourced per authUserId they collapse to one.
 */
export const profileMemberRecipients = () =>
  db
    .selectDistinct({
      authUserId: profileUsers.authUserId,
      email: authUsers.email,
    })
    .from(profileUsers)
    .innerJoin(authUsers, eq(authUsers.id, profileUsers.authUserId));

/**
 * Admins of the organization behind an org profile. An organization never
 * logs in, so mail addressed to one goes to the people who run it — not to
 * the org's public contact address.
 */
export const organizationAdminRecipients = (organizationProfileId: string) =>
  db
    .selectDistinct({
      authUserId: organizationUsers.authUserId,
      email: authUsers.email,
    })
    .from(organizationUsers)
    .innerJoin(
      organizations,
      eq(organizations.id, organizationUsers.organizationId),
    )
    .innerJoin(authUsers, eq(authUsers.id, organizationUsers.authUserId))
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
        eq(organizations.profileId, organizationProfileId),
        eq(accessRoles.name, 'Admin'),
      ),
    );

/**
 * Who a notification addressed to a profile reaches, by what kind of profile
 * it is: the owner of an individual profile, the admins of an organization,
 * and every member of a proposal or decision profile. Senders hand over the
 * profile they have — a post's author, a vote's submitter, a proposal — and
 * do not need to know which shape it is.
 */
export async function listProfileRecipients({
  profileId,
}: {
  profileId: string;
}): Promise<Array<EmailRecipient>> {
  const profile = await db.query.profiles.findFirst({
    where: { id: profileId },
    columns: { type: true },
  });

  switch (profile?.type) {
    case undefined:
      return [];
    case EntityType.INDIVIDUAL:
    case EntityType.USER:
      return profileOwnerRecipients(profileId);
    case EntityType.ORG:
      return organizationAdminRecipients(profileId);
    default:
      return profileMemberRecipients().where(
        eq(profileUsers.profileId, profileId),
      );
  }
}
