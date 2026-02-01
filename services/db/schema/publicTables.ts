// Public tables are included in migrations
export { accessRoles, type AccessRole } from './tables/access.sql';
export {
  accessRolePermissionsOnAccessZones,
  accessRolePermissionsOnAccessZonesRelations,
  accessRolesRelations,
  accessZones,
  accessZonesRelations,
} from './tables/accessZones.sql';
export {
  individuals,
  individualsRelations,
  individualsTerms,
  individualsTermsRelations,
} from './tables/individuals.sql';
export { links, linksRelations, linkTypeEnum } from './tables/links.sql';
export {
  organizations,
  organizationsRelations,
  organizationsStrategies, // reconsider these tables as possible graphs and edges
  organizationsStrategiesRelations,
  organizationsTerms,
  organizationsTermsRelations,
  organizationsWhereWeWork,
  organizationsWhereWeWorkRelations,
  orgTypeEnum,
} from './tables/organizations.sql';
export type { Organization } from './tables/organizations.sql';
export {
  organizationUsers,
  organizationUsersRelations,
  organizationUserToAccessRoles,
  organizationUserToAccessRolesRelations,
  type OrganizationUser,
} from './tables/organizationUsers.sql';

export {
  profileUsers,
  profileUsersRelations,
  profileUserToAccessRoles,
  profileUserToAccessRolesRelations,
} from './tables/profileUsers.sql';
export type { ProfileUser } from './tables/profileUsers.sql';

export { profileInvites, profileInvitesRelations } from './tables/profileInvites.sql';
export type { ProfileInvite } from './tables/profileInvites.sql';

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

export { attachments, attachmentsRelations } from './tables/attachments.sql';

export {
  taxonomies,
  taxonomiesRelations,
  taxonomyTerms,
  taxonomyTermsRelations,
} from './tables/taxonomies.sql';

export {
  allowList,
  allowListRelations,
  type AllowList,
} from './tables/allowList.sql';
export { EntityType, entityTypeEnum } from './tables/entities.sql';
export {
  JoinProfileRequestStatus,
  joinProfileRequests,
  joinProfileRequestsRelations,
  joinProfileRequestsStatusEnum,
  type JoinProfileRequest,
} from './tables/joinProfileRequests.sql';
export { locations } from './tables/locations.sql';
export { profiles, profilesRelations } from './tables/profiles.sql';
export type { Profile } from './tables/profiles.sql';
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
  proposalCategories,
  proposalCategoriesRelations,
  proposals,
  proposalsRelations,
  ProposalStatus,
  proposalStatusEnum,
} from './tables/proposals.sql';
export type { Proposal, ProposalCategory } from './tables/proposals.sql';

export { Visibility, visibilityEnum } from './tables/visibility.sql';

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
