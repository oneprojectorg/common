import type { ProfileUserWithRelations } from './getProfileUserWithRelations';

export type MemberStatus = 'active' | 'pending';

/**
 * Profile member type that includes both active members and pending invites.
 * Active members have full ProfileUser data, pending invites have minimal data.
 * authUserId is null for pending invites (user not yet assigned).
 */
export type ProfileMember = Omit<ProfileUserWithRelations, 'authUserId'> & {
  authUserId: string | null;
  status: MemberStatus;
  inviteId?: string; // Only present for pending invites
};
