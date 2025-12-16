/**
 * Channel name builders - convention: scope[:id]
 */
export const Channels = {
  global: () => 'global' as const,
  org: (orgId: string) => `org:${orgId}` as const,
  user: (userId: string) => `user:${userId}` as const,
  profileRelationship: ({
    profileId,
    type,
  }: {
    profileId: string;
    type: 'target' | 'source';
  }) => `profileRelationship:${type}:${profileId}` as const,
} as const;

export type GlobalChannel = ReturnType<typeof Channels.global>;
export type OrgChannel = ReturnType<typeof Channels.org>;
export type UserChannel = ReturnType<typeof Channels.user>;
export type ProfileRelationshipChannel = ReturnType<
  typeof Channels.profileRelationship
>;

/**
 * Union of all valid channel types
 */
export type ChannelName =
  | GlobalChannel
  | OrgChannel
  | UserChannel
  | ProfileRelationshipChannel;
