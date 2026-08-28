import { and, db, eq } from '@op/db/client';
import {
  NotificationChannel,
  authUsers,
  profileUsers,
  users,
} from '@op/db/schema';

import { excludeGlobalUsers } from '../../utils/db';

/**
 * One participant, and how to reach them.
 *
 * `channel` is the channel to actually use, not the raw stored preference. See
 * {@link getNotificationRecipients} for the fallback that resolves the two.
 */
export interface NotificationRecipient {
  authUserId: string;
  /** The address this profile membership carries. Null when none is recorded. */
  email: string | null;
  /**
   * A confirmed phone number, or null. An unconfirmed number is never here.
   *
   * Stored by Supabase, so it is not validated again on the way out. Pass it
   * through `parsePhoneNumber` at the send boundary before handing it to a
   * provider, the same as any other number arriving from a row.
   */
  phone: string | null;
  /** The channel to send on. Never names a channel we cannot reach. */
  channel: NotificationChannel;
}

/**
 * Reads every participant of one profile, with the channel to reach each on.
 *
 * Call this instead of querying recipients inline. Twelve notification
 * functions each build their own recipient query today, across three different
 * source columns. This is the one reader they will move onto.
 *
 * The returned `channel` is already resolved. A person who chose SMS and has no
 * confirmed number comes back as `email`, because a preference we cannot honour
 * must not become a dropped notification. A caller sends on `channel` and does
 * not re-derive it.
 *
 * A phone number is only ever returned once `auth.users.phone_confirmed_at` is
 * set. Supabase confirms that column, so an unconfirmed number is not an
 * address, and this reader treats it as absent.
 *
 * The preference lives on the account, not on the membership, so a person who
 * belongs to several profiles has one preference across all of them. Making it
 * per profile is a later change.
 *
 * @param input.profileId - The profile whose participants to read.
 * @returns One row per participant. The order is the database's; no caller may
 *   rely on it. A row can carry a null address on its resolved channel, when a
 *   membership records no email and confirms no phone. Skip such a row rather
 *   than handing a null address to a provider.
 *
 * @example Send to everyone who wants SMS
 * ```ts
 * const recipients = await getNotificationRecipients({ profileId });
 * const bySms = recipients.filter((r) => r.channel === NotificationChannel.SMS);
 * ```
 */
export const getNotificationRecipients = async ({
  profileId,
}: {
  profileId: string;
}): Promise<NotificationRecipient[]> => {
  const rows = await db
    .select({
      authUserId: profileUsers.authUserId,
      // Read the membership's email, not `users.email`. Today's notification
      // functions read this column, so this reader resolves the same people.
      email: profileUsers.email,
      phone: authUsers.phone,
      phoneConfirmedAt: authUsers.phoneConfirmedAt,
      channel: users.notificationChannel,
    })
    .from(profileUsers)
    // Left, not inner: a membership whose `users` row is missing still gets a
    // notification on the default channel. An inner join would silently drop
    // that person, which is a worse failure than a missing preference.
    .leftJoin(users, eq(users.authUserId, profileUsers.authUserId))
    .leftJoin(authUsers, eq(authUsers.id, profileUsers.authUserId))
    .where(
      and(
        eq(profileUsers.profileId, profileId),
        // The public-access sentinels hold real membership rows. Every reader
        // that surfaces members drops them, or they become ghost recipients.
        excludeGlobalUsers(profileUsers.authUserId),
      ),
    );

  return rows.map(toNotificationRecipient);
};

/**
 * One row as the recipients query reads it, before the rules are applied.
 *
 * `channel` is a plain string, not {@link NotificationChannel}. `enumToPgEnum`
 * widens a pgEnum's values to `string`, so the column reads back unnarrowed.
 * {@link toNotificationRecipient} narrows it, and treats anything it does not
 * recognise as email.
 */
export interface NotificationRecipientRow {
  authUserId: string;
  email: string | null;
  phone: string | null;
  phoneConfirmedAt: Date | null;
  channel: string | null;
}

/**
 * Applies our two delivery rules to one queried row.
 *
 * Exported so the rules can be tested without a database. The rules are the
 * part worth testing; the join around them is plumbing.
 *
 * An unconfirmed phone number becomes `null`, because Supabase sets
 * `phone_confirmed_at` and an unconfirmed number is not an address. A
 * preference of SMS with no confirmed number falls back to email, because a
 * preference we cannot honour must not become a dropped notification.
 *
 * @param row - One row from the recipients query.
 * @returns The participant, with the channel to actually send on.
 */
export const toNotificationRecipient = (
  row: NotificationRecipientRow,
): NotificationRecipient => {
  const phone = row.phoneConfirmedAt && row.phone ? row.phone : null;
  // Narrow to SMS only on an exact match. A null channel, or a value this
  // build does not know, resolves to email — the direction that still reaches
  // the participant.
  const wantsSms = row.channel === NotificationChannel.SMS;
  return {
    authUserId: row.authUserId,
    email: row.email,
    phone,
    channel:
      wantsSms && phone ? NotificationChannel.SMS : NotificationChannel.EMAIL,
  };
};
