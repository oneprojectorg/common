// Public tables are included in migrations
export { accessRoles } from './tables/access.sql';
export {
  accessZones,
  accessZonesRelations,
  accessRolePermissionsOnAccessZones,
  accessRolePermissionsOnAccessZonesRelations,
  accessRolesRelations,
} from './tables/accessZones.sql';
export { links, linksRelations, linkTypeEnum } from './tables/links.sql';
export {
  organizations,
  organizationsRelations,
  orgTypeEnum,
  organizationsWhereWeWork,
  organizationsWhereWeWorkRelations,
  organizationsStrategies, // reconsider these tables as possible graphs and edges
  organizationsStrategiesRelations,
  organizationsTerms,
  organizationsTermsRelations,
} from './tables/organizations.sql';
export {
  individuals,
  individualsTerms,
  individualsRelations,
  individualsTermsRelations,
} from './tables/individuals.sql';
export type { Organization } from './tables/organizations.sql';
export {
  organizationUsers,
  organizationUsersRelations,
  organizationUserToAccessRoles,
  organizationUserToAccessRolesRelations,
} from './tables/organizationUsers.sql';

export {
  posts,
  postsRelations,
  postsToOrganizations,
  postsToOrganizationsRelations,
  postsToProfiles,
  postsToProfilesRelations,
} from './tables/posts.sql';
export type {
  Post,
  PostToOrganization,
  PostToProfile,
} from './tables/posts.sql';

export {
  postReactions,
  postReactionsRelations,
} from './tables/postReactions.sql';

export {
  comments,
  commentsRelations,
  commentsToPost,
  commentsToPostRelations,
} from './tables/comments.sql';
export type { Comment, CommentToPost } from './tables/comments.sql';

export { attachments, attachmentsRelations } from './tables/attachments.sql';

export {
  taxonomies,
  taxonomyTerms,
  taxonomyTermsRelations,
  taxonomiesRelations,
} from './tables/taxonomies.sql';

export { projects, projectsRelations } from './tables/projects.sql';
export {
  organizationRelationships,
  organizationRelationshipsRelations,
  profileRelationships,
  profileRelationshipsRelations,
  ProfileRelationshipType,
  profileRelationshipTypeEnum,
} from './tables/relationships.sql';
export { users, usersRelations } from './tables/users.sql';
export type { CommonUser } from './tables/users.sql';
export { usersUsedStorage } from './tables/usersUsedStorage.sql';
export { locations } from './tables/locations.sql';
export { profiles, profilesRelations } from './tables/profiles.sql';
export type { Profile } from './tables/profiles.sql';
export { EntityType, entityTypeEnum } from './tables/entities.sql';
export { allowList, allowListRelations } from './tables/allowList.sql';

// Decision system tables
export {
  decisionProcesses,
  decisionProcessesRelations,
} from './tables/decisionProcesses.sql';
export type { DecisionProcess } from './tables/decisionProcesses.sql';

export {
  processInstances,
  processInstancesRelations,
  ProcessStatus,
  processStatusEnum,
} from './tables/processInstances.sql';
export type { ProcessInstance } from './tables/processInstances.sql';

export {
  proposals,
  proposalsRelations,
  proposalCategories,
  proposalCategoriesRelations,
  ProposalStatus,
  proposalStatusEnum,
} from './tables/proposals.sql';
export type { Proposal, ProposalCategory } from './tables/proposals.sql';

export {
  proposalHistory,
  proposalHistoryRelations,
} from './tables/proposalHistory.sql';
export type { ProposalHistory } from './tables/proposalHistory.sql';

export {
  proposalAttachments,
  proposalAttachmentsRelations,
} from './tables/proposalAttachments.sql';

export { decisions, decisionsRelations } from './tables/decisions.sql';
export type { Decision } from './tables/decisions.sql';

export {
  decisionsVoteSubmissions,
  decisionsVoteSubmissionsRelations,
} from './tables/decisions_vote_submissions.sql';
export type {
  DecisionVoteSubmission,
  VoteData,
} from './tables/decisions_vote_submissions.sql';

export {
  decisionsVoteProposals,
  decisionsVoteProposalsRelations,
} from './tables/decisions_vote_proposals.sql';
export type { DecisionVoteProposal } from './tables/decisions_vote_proposals.sql';

export {
  stateTransitionHistory,
  stateTransitionHistoryRelations,
} from './tables/stateTransitionHistory.sql';
export type { StateTransitionHistory } from './tables/stateTransitionHistory.sql';

export {
  decisionProcessTransitions,
  decisionProcessTransitionsRelations,
} from './tables/processTransitions.sql';
export type { DecisionProcessTransition } from './tables/processTransitions.sql';

export {
  decisionProcessResults,
  decisionProcessResultsRelations,
} from './tables/decisionProcessResults.sql';
export type { DecisionProcessResult } from './tables/decisionProcessResults.sql';

export {
  decisionProcessResultSelections,
  decisionProcessResultSelectionsRelations,
} from './tables/decisionProcessResultSelections.sql';
export type { DecisionProcessResultSelection } from './tables/decisionProcessResultSelections.sql';

export type { ObjectsInStorage } from './tables/storage.sql';

// Module activation tables
export {
  modules,
  modulesRelations,
  profileModules,
  profileModulesRelations,
} from './tables/modules.sql';
export type { Module, ProfileModule } from './tables/modules.sql';
