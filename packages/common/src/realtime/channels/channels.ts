/**
 * Channel name builders - convention: scope[:id]
 */
export const Channels = {
  global: () => 'global' as const,
  org: (orgId: string) => `org:${orgId}` as const,
  user: (userId: string) => `user:${userId}` as const,
  /**
   * Channel for join profile request invalidation.
   * @param profileId - The profile ID involved in the request
   * @param type - 'source' for requests FROM this profile, 'target' for requests TO this profile
   */
  profileJoinRequest: ({
    type,
    profileId,
  }: {
    type: 'source' | 'target';
    profileId: string;
  }) => `profileJoinRequest:${type}:${profileId}` as const,
} as const;

export type GlobalChannel = ReturnType<typeof Channels.global>;
export type OrgChannel = ReturnType<typeof Channels.org>;
export type UserChannel = ReturnType<typeof Channels.user>;
export type ProfileJoinRequestChannel = ReturnType<
  typeof Channels.profileJoinRequest
>;

/**
 * Union of all valid channel types
 */
export type ChannelName =
  | GlobalChannel
  | OrgChannel
  | UserChannel
  | ProfileJoinRequestChannel;
