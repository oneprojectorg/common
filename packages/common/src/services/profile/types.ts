import type { ProfileUserWithRelations } from './getProfileUserWithRelations';

export type MemberStatus = 'active' | 'pending';

/**
 * Profile member type that includes both active members and pending invites.
 * Active members have full ProfileUser data, pending invites have minimal data.
 */
export type ProfileMember = ProfileUserWithRelations & {
  status: MemberStatus;
  inviteId?: string; // Only present for pending invites
};
