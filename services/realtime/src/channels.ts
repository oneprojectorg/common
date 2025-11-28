/**
 * Channel name builders - convention: trpc:scope[:id]
 * All channels are prefixed with 'trpc:' to indicate they're for tRPC invalidations
 */
export const Channels = {
  global: () => 'trpc:global' as const,
  org: (orgId: string) => `trpc:org:${orgId}` as const,
  user: (userId: string) => `trpc:user:${userId}` as const,
} as const;

export type GlobalChannel = ReturnType<typeof Channels.global>;
export type OrgChannel = ReturnType<typeof Channels.org>;
export type UserChannel = ReturnType<typeof Channels.user>;

/**
 * Union of all valid channel types
 */
export type ChannelName = GlobalChannel | OrgChannel | UserChannel;
