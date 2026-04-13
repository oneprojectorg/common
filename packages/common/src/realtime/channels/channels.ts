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

  decisionInstance: (instanceId: string) =>
    `decisionInstance:${instanceId}` as const,

  decisionProposals: (instanceId: string) =>
    `decisionProposals:${instanceId}` as const,

  decisionProposal: (instanceId: string, proposalId: string) =>
    `decisionProposal:${instanceId}:${proposalId}` as const,

  reviewAssignment: (assignmentId: string) =>
    `reviewAssignment:${assignmentId}` as const,

  reviewAssignments: (instanceId: string) =>
    `reviewAssignments:${instanceId}` as const,
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
export type DecisionInstanceChannel = ReturnType<
  typeof Channels.decisionInstance
>;
export type DecisionProposalsChannel = ReturnType<
  typeof Channels.decisionProposals
>;
export type DecisionProposalChannel = ReturnType<
  typeof Channels.decisionProposal
>;
export type ReviewAssignmentChannel = ReturnType<
  typeof Channels.reviewAssignment
>;
export type ReviewAssignmentsChannel = ReturnType<
  typeof Channels.reviewAssignments
>;

/**
 * Union of all valid channel types
 */
export type ChannelName =
  | GlobalChannel
  | OrgChannel
  | UserChannel
  | ProfileJoinRequestChannel
  | OrgRelationshipRequestChannel
  | DecisionInstanceChannel
  | DecisionProposalsChannel
  | DecisionProposalChannel
  | ReviewAssignmentChannel
  | ReviewAssignmentsChannel;
