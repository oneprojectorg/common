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

  orgRelationshipRequest: ({
    type,
    orgId,
  }: {
    type: 'source' | 'target';
    orgId: string;
  }) => `orgRelationshipRequest:${type}:${orgId}` as const,

  /**
   * Channel for poll live updates (votes, close events)
   * @param pollId - The poll ID to subscribe to
   */
  poll: (pollId: string) => `poll:${pollId}` as const,

  /**
   * Channel for listing polls in a proposal
   * @param proposalId - The proposal ID to subscribe to
   */
  proposalPolls: (proposalId: string) =>
    `proposal:${proposalId}:polls` as const,
} as const;

export type GlobalChannel = ReturnType<typeof Channels.global>;
export type OrgChannel = ReturnType<typeof Channels.org>;
export type UserChannel = ReturnType<typeof Channels.user>;
export type ProfileJoinRequestChannel = ReturnType<
  typeof Channels.profileJoinRequest
>;
export type OrgRelationshipRequestChannel = ReturnType<
  typeof Channels.orgRelationshipRequest
>;
export type PollChannel = ReturnType<typeof Channels.poll>;
export type ProposalPollsChannel = ReturnType<typeof Channels.proposalPolls>;

/**
 * Union of all valid channel types
 */
export type ChannelName =
  | GlobalChannel
  | OrgChannel
  | UserChannel
  | ProfileJoinRequestChannel
  | OrgRelationshipRequestChannel
  | PollChannel
  | ProposalPollsChannel;
