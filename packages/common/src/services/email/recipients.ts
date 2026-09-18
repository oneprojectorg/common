import { db } from '@op/db/client';
import { EntityType, type Profile } from '@op/db/schema';

export type EmailRecipient = {
  authUserId: string;
  /** Null for anonymous accounts. */
  email: string | null;
};

/**
 * Delivery addresses come from `auth.users.email` only. Every other email
 * column is an unsynced snapshot (`profile_users.email`, `public.users.email`)
 * or an unverified public contact field (`profiles.email`).
 */

/** The account that owns an individual profile. */
export const listIndividualProfileRecipients = async (
  profileId: string,
): Promise<Array<EmailRecipient>> => {
  const owners = await db.query.users.findMany({
    where: { profileId },
    columns: { authUserId: true },
    with: { authUser: { columns: { email: true } } },
  });

  return owners.map(toRecipient);
};

/** The admins of the organization behind an org profile. */
export const listOrganizationProfileRecipients = async (
  organizationProfileId: string,
): Promise<Array<EmailRecipient>> => {
  const admins = await db.query.organizationUsers.findMany({
    where: {
      organization: { profileId: organizationProfileId },
      roles: { accessRole: { name: 'Admin' } },
    },
    columns: { authUserId: true },
    with: { authUser: { columns: { email: true } } },
  });

  return uniqueByAccount(admins.map(toRecipient));
};

/** Every member of a proposal or decision profile. */
export const listMemberProfileRecipients = async (
  profileId: string,
): Promise<Array<EmailRecipient>> => {
  const byProfile = await listMemberProfileRecipientsByProfile([profileId]);

  return byProfile.get(profileId) ?? [];
};

export const listMemberProfileRecipientsByProfile = async (
  profileIds: Array<string>,
): Promise<Map<string, Array<EmailRecipient>>> => {
  const unique = [...new Set(profileIds)];

  if (unique.length === 0) {
    return new Map();
  }

  const members = await db.query.profileUsers.findMany({
    where: { profileId: { in: unique } },
    columns: { authUserId: true, profileId: true },
    with: { authUser: { columns: { email: true } } },
  });

  const byProfile = new Map<string, Array<EmailRecipient>>();

  for (const member of members) {
    const recipients = byProfile.get(member.profileId) ?? [];
    recipients.push(toRecipient(member));
    byProfile.set(member.profileId, recipients);
  }

  // Dedup within a profile, not across: one person on two proposals hears
  // about each.
  return new Map(
    [...byProfile].map(([profileId, recipients]) => [
      profileId,
      uniqueByAccount(recipients),
    ]),
  );
};

/** Dispatches on the profile type when the caller cannot know it statically. */
export const listProfileRecipients = (
  profile: Pick<Profile, 'id' | 'type'>,
): Promise<Array<EmailRecipient>> => {
  switch (profile.type) {
    case EntityType.INDIVIDUAL:
    case EntityType.USER:
      return listIndividualProfileRecipients(profile.id);
    case EntityType.ORG:
      return listOrganizationProfileRecipients(profile.id);
    default:
      return listMemberProfileRecipients(profile.id);
  }
};

const toRecipient = (row: {
  authUserId: string;
  authUser: { email: string | null };
}): EmailRecipient => ({
  authUserId: row.authUserId,
  email: row.authUser.email,
});

/** One person can hold several member rows; keep one recipient per account. */
const uniqueByAccount = (
  recipients: Array<EmailRecipient>,
): Array<EmailRecipient> => {
  const seen = new Set<string>();

  return recipients.filter(({ authUserId }) => {
    if (seen.has(authUserId)) {
      return false;
    }
    seen.add(authUserId);
    return true;
  });
};
