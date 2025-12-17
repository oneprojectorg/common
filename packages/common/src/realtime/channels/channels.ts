/**
 * Channel name builders - convention: scope[:id]
 */
export const Channels = {
  global: () => 'global' as const,
  org: (orgId: string) => `org:${orgId}` as const,
  user: (userId: string) => `user:${userId}` as const,
  profile: {
    /**
     * Channel for join profile request invalidation.
     * @param profileId - The profile ID involved in the request
     * @param type - 'source' for requests FROM this profile, 'target' for requests TO this profile
     */
    joinRequest: ({
      profileId,
      type,
    }: {
      profileId: string;
      type: 'source' | 'target';
    }) => `profile:joinRequest:${type}:${profileId}` as const,
  },
} as const;

export type GlobalChannel = ReturnType<typeof Channels.global>;
export type OrgChannel = ReturnType<typeof Channels.org>;
export type UserChannel = ReturnType<typeof Channels.user>;
export type JoinRequestChannel = ReturnType<
  typeof Channels.profile.joinRequest
>;

/**
 * Union of all valid channel types
 */
export type ChannelName =
  | GlobalChannel
  | OrgChannel
  | UserChannel
  | JoinRequestChannel;
