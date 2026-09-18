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

/** The same as `listIndividualProfileRecipients`, for many profiles at once. */
export const listIndividualProfileRecipientsByProfileId = async (
  profileIds: ReadonlyArray<string>,
): Promise<Map<string, Array<EmailRecipient>>> => {
  const byProfileId = new Map<string, Array<EmailRecipient>>();

  if (profileIds.length === 0) {
    return byProfileId;
  }

  const owners = await db.query.users.findMany({
    where: { profileId: { in: [...profileIds] } },
    columns: { profileId: true, authUserId: true },
    with: { authUser: { columns: { email: true } } },
  });

  for (const owner of owners) {
    if (!owner.profileId) {
      continue;
    }

    const recipients = byProfileId.get(owner.profileId);

    if (recipients) {
      recipients.push(toRecipient(owner));
    } else {
      byProfileId.set(owner.profileId, [toRecipient(owner)]);
    }
  }

  return byProfileId;
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
  const members = await db.query.profileUsers.findMany({
    where: { profileId },
    columns: { authUserId: true },
    with: { authUser: { columns: { email: true } } },
  });

  return uniqueByAccount(members.map(toRecipient));
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

/** The same as `listProfileRecipients`, for many profiles at once. */
export const listProfileRecipientsByProfileId = async (
  profiles: ReadonlyArray<Pick<Profile, 'id' | 'type'>>,
): Promise<Map<string, Array<EmailRecipient>>> => {
  const individualProfileIds: Array<string> = [];
  const organizationProfileIds: Array<string> = [];
  const memberProfileIds: Array<string> = [];

  for (const profile of profiles) {
    switch (profile.type) {
      case EntityType.INDIVIDUAL:
      case EntityType.USER:
        individualProfileIds.push(profile.id);
        break;
      case EntityType.ORG:
        organizationProfileIds.push(profile.id);
        break;
      default:
        memberProfileIds.push(profile.id);
    }
  }

  const byProfileId =
    await listIndividualProfileRecipientsByProfileId(individualProfileIds);

  for (const profileId of organizationProfileIds) {
    byProfileId.set(
      profileId,
      await listOrganizationProfileRecipients(profileId),
    );
  }

  for (const profileId of memberProfileIds) {
    byProfileId.set(profileId, await listMemberProfileRecipients(profileId));
  }

  return byProfileId;
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
