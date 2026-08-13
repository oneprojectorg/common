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

  /**
   * Channel for the set of people who have voted in an instance. Subscribed to
   * by the voter roster, broadcast to by vote submission. Kept separate from
   * `decisionInstance` so a vote doesn't invalidate the instance snapshot,
   * categories, and selection candidates for every viewer.
   */
  decisionVoters: (instanceId: string) =>
    `decisionVoters:${instanceId}` as const,

  decisionProposal: (instanceId: string, proposalId: string) =>
    `decisionProposal:${instanceId}:${proposalId}` as const,

  reviewAssignment: (assignmentId: string) =>
    `reviewAssignment:${assignmentId}` as const,

  reviewAssignments: (instanceId: string) =>
    `reviewAssignments:${instanceId}` as const,

  /**
   * Channel for top-level posts on a profile (user, org, or decision).
   * Subscribed to by post-feed queries, broadcast to by post creation and
   * reactions on those posts.
   */
  profilePosts: (profileId: string) => `profilePosts:${profileId}` as const,

  /**
   * Channel for comments under a specific post. Subscribed to by comment-list
   * queries, broadcast to by post creation and reactions on comments.
   */
  postComments: (postId: string) => `postComments:${postId}` as const,

  /**
   * Channel for the flattened list of resources across a profile's
   * collections. Subscribed to by resources.list and broadcast to by any
   * resource mutation affecting the profile.
   */
  profileResources: (profileId: string) =>
    `profileResources:${profileId}` as const,

  /**
   * Channel for resources inside a specific collection. Subscribed to by
   * resources.listByCollection and broadcast to by mutations targeting the
   * collection.
   */
  collectionResources: (collectionId: string) =>
    `collectionResources:${collectionId}` as const,

  /**
   * Channel for the collections list of a profile. Subscribed to by
   * collections.list and resources.list (collection order drives the
   * flattened list's order), broadcast to by collection-level mutations.
   */
  profileCollections: (profileId: string) =>
    `profileCollections:${profileId}` as const,
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
export type DecisionVotersChannel = ReturnType<typeof Channels.decisionVoters>;
export type DecisionProposalChannel = ReturnType<
  typeof Channels.decisionProposal
>;
export type ReviewAssignmentChannel = ReturnType<
  typeof Channels.reviewAssignment
>;
export type ReviewAssignmentsChannel = ReturnType<
  typeof Channels.reviewAssignments
>;
export type ProfilePostsChannel = ReturnType<typeof Channels.profilePosts>;
export type PostCommentsChannel = ReturnType<typeof Channels.postComments>;
export type ProfileResourcesChannel = ReturnType<
  typeof Channels.profileResources
>;
export type CollectionResourcesChannel = ReturnType<
  typeof Channels.collectionResources
>;
export type ProfileCollectionsChannel = ReturnType<
  typeof Channels.profileCollections
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
  | DecisionVotersChannel
  | DecisionProposalChannel
  | ReviewAssignmentChannel
  | ReviewAssignmentsChannel
  | ProfilePostsChannel
  | PostCommentsChannel
  | ProfileResourcesChannel
  | CollectionResourcesChannel
  | ProfileCollectionsChannel;
