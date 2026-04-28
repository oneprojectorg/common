/**
 * Drizzle Relations v2 definitions
 *
 * Single source of truth for v2 relational query relations.
 * Relations are defined here using `defineRelations`.
 *
 * Note: v1 relations still exist in individual *.sql.ts files for `db._query`.
 * This file is for the new `db.query` API.
 *
 * @see https://orm.drizzle.team/docs/relations-v1-v2
 */
import { defineRelations } from 'drizzle-orm';

import * as schema from './schema';

export const relations = defineRelations(schema, (r) => ({
  /**
   * Proposal relations
   *
   * processInstanceId, submittedByProfileId, and profileId are NOT NULL,
   * so we mark them as optional: false.
   */
  proposals: {
    processInstance: r.one.processInstances({
      from: r.proposals.processInstanceId,
      to: r.processInstances.id,
      optional: false,
    }),
    submittedBy: r.one.profiles({
      from: r.proposals.submittedByProfileId,
      to: r.profiles.id,
      alias: 'proposal_submittedBy',
      optional: false,
    }),
    profile: r.one.profiles({
      from: r.proposals.profileId,
      to: r.profiles.id,
      alias: 'proposal_profile',
      optional: false,
    }),
    attachments: r.many.proposalAttachments({
      from: r.proposals.id,
      to: r.proposalAttachments.proposalId,
    }),
    reviewAssignments: r.many.proposalReviewAssignments({
      from: r.proposals.id,
      to: r.proposalReviewAssignments.proposalId,
    }),
    transitionProposals: r.many.decisionTransitionProposals({
      from: r.proposals.id,
      to: r.decisionTransitionProposals.proposalId,
    }),
  },

  /**
   * Decision Transition Proposals relations (junction table)
   *
   * Links state transitions to the proposals that were active at that point.
   */
  decisionTransitionProposals: {
    transitionHistory: r.one.stateTransitionHistory({
      from: r.decisionTransitionProposals.transitionHistoryId,
      to: r.stateTransitionHistory.id,
      optional: false,
    }),
    proposal: r.one.proposals({
      from: r.decisionTransitionProposals.proposalId,
      to: r.proposals.id,
      optional: false,
    }),
    proposalHistorySnapshot: r.one.proposalHistory({
      from: r.decisionTransitionProposals.proposalHistoryId,
      to: r.proposalHistory.historyId,
      optional: false,
    }),
  },

  /**
   * State Transition History relations
   */
  stateTransitionHistory: {
    processInstance: r.one.processInstances({
      from: r.stateTransitionHistory.processInstanceId,
      to: r.processInstances.id,
      optional: false,
    }),
    triggeredBy: r.one.profiles({
      from: r.stateTransitionHistory.triggeredByProfileId,
      to: r.profiles.id,
      alias: 'stateTransitionHistory_triggeredBy',
    }),
    transitionProposals: r.many.decisionTransitionProposals({
      from: r.stateTransitionHistory.id,
      to: r.decisionTransitionProposals.transitionHistoryId,
    }),
  },

  /**
   * Proposal History relations
   */
  proposalHistory: {
    proposal: r.one.proposals({
      from: r.proposalHistory.id,
      to: r.proposals.id,
      optional: false,
    }),
    processInstance: r.one.processInstances({
      from: r.proposalHistory.processInstanceId,
      to: r.processInstances.id,
      optional: false,
    }),
    submittedBy: r.one.profiles({
      from: r.proposalHistory.submittedByProfileId,
      to: r.profiles.id,
      alias: 'proposalHistory_submittedBy',
      optional: false,
    }),
    profile: r.one.profiles({
      from: r.proposalHistory.profileId,
      to: r.profiles.id,
      alias: 'proposalHistory_profile',
      optional: false,
    }),
    lastEditedBy: r.one.profiles({
      from: r.proposalHistory.lastEditedByProfileId,
      to: r.profiles.id,
      alias: 'proposalHistory_lastEditedBy',
    }),
    assignedByReviewAssignments: r.many.proposalReviewAssignments({
      from: r.proposalHistory.historyId,
      to: r.proposalReviewAssignments.assignedProposalHistoryId,
    }),
    requestedByReviewRequests: r.many.proposalReviewRequests({
      from: r.proposalHistory.historyId,
      to: r.proposalReviewRequests.requestedProposalHistoryId,
    }),
    respondedByReviewRequests: r.many.proposalReviewRequests({
      from: r.proposalHistory.historyId,
      to: r.proposalReviewRequests.respondedProposalHistoryId,
    }),
  },

  /**
   * Proposal Attachment relations (join table)
   *
   * Links proposals to their attachments with uploader info.
   */
  proposalAttachments: {
    attachment: r.one.attachments({
      from: r.proposalAttachments.attachmentId,
      to: r.attachments.id,
      optional: false,
    }),
  },

  /**
   * Attachment relations
   */
  attachments: {
    storageObject: r.one.objectsInStorage({
      from: r.attachments.storageObjectId,
      to: r.objectsInStorage.id,
      optional: false,
    }),
  },

  /**
   * Profile relations
   *
   * avatarImageId and headerImageId are nullable.
   */
  profiles: {
    avatarImage: r.one.objectsInStorage({
      from: r.profiles.avatarImageId,
      to: r.objectsInStorage.id,
    }),
    headerImage: r.one.objectsInStorage({
      from: r.profiles.headerImageId,
      to: r.objectsInStorage.id,
    }),
    processInstance: r.one.processInstances({
      from: r.profiles.id,
      to: r.processInstances.profileId,
    }),
    organization: r.one.organizations({
      from: r.profiles.id,
      to: r.organizations.profileId,
    }),
    profileUsers: r.many.profileUsers({
      from: r.profiles.id,
      to: r.profileUsers.profileId,
    }),
    reviewerAssignments: r.many.proposalReviewAssignments({
      from: r.profiles.id,
      to: r.proposalReviewAssignments.reviewerProfileId,
    }),
  },

  /**
   * Process instance relations
   *
   * stewardProfileId is nullable.
   */
  processInstances: {
    process: r.one.decisionProcesses({
      from: r.processInstances.processId,
      to: r.decisionProcesses.id,
      optional: false,
    }),
    profile: r.one.profiles({
      from: r.processInstances.profileId,
      to: r.profiles.id,
      alias: 'processInstance_profile',
    }),
    owner: r.one.profiles({
      from: r.processInstances.ownerProfileId,
      to: r.profiles.id,
      alias: 'processInstance_owner',
      optional: false,
    }),
    steward: r.one.profiles({
      from: r.processInstances.stewardProfileId,
      to: r.profiles.id,
      alias: 'processInstance_steward',
    }),
    proposals: r.many.proposals({
      from: r.processInstances.id,
      to: r.proposals.processInstanceId,
    }),
    reviewAssignments: r.many.proposalReviewAssignments({
      from: r.processInstances.id,
      to: r.proposalReviewAssignments.processInstanceId,
    }),
  },

  /**
   * Proposal review assignment relations.
   */
  proposalReviewAssignments: {
    processInstance: r.one.processInstances({
      from: r.proposalReviewAssignments.processInstanceId,
      to: r.processInstances.id,
      optional: false,
    }),
    proposal: r.one.proposals({
      from: r.proposalReviewAssignments.proposalId,
      to: r.proposals.id,
      optional: false,
    }),
    assignedProposalHistory: r.one.proposalHistory({
      from: r.proposalReviewAssignments.assignedProposalHistoryId,
      to: r.proposalHistory.historyId,
      alias: 'proposalReviewAssignment_assignedHistory',
    }),
    reviewer: r.one.profiles({
      from: r.proposalReviewAssignments.reviewerProfileId,
      to: r.profiles.id,
      alias: 'proposalReviewAssignment_reviewer',
      optional: false,
    }),
    requests: r.many.proposalReviewRequests({
      from: r.proposalReviewAssignments.id,
      to: r.proposalReviewRequests.assignmentId,
    }),
    reviews: r.many.proposalReviews({
      from: r.proposalReviewAssignments.id,
      to: r.proposalReviews.assignmentId,
    }),
  },

  /**
   * Proposal review request relations.
   */
  proposalReviewRequests: {
    assignment: r.one.proposalReviewAssignments({
      from: r.proposalReviewRequests.assignmentId,
      to: r.proposalReviewAssignments.id,
      optional: false,
    }),
    requestedProposalHistory: r.one.proposalHistory({
      from: r.proposalReviewRequests.requestedProposalHistoryId,
      to: r.proposalHistory.historyId,
    }),
    respondedProposalHistory: r.one.proposalHistory({
      from: r.proposalReviewRequests.respondedProposalHistoryId,
      to: r.proposalHistory.historyId,
    }),
  },

  /**
   * Proposal review relations.
   */
  proposalReviews: {
    assignment: r.one.proposalReviewAssignments({
      from: r.proposalReviews.assignmentId,
      to: r.proposalReviewAssignments.id,
      optional: false,
    }),
  },

  /**
   * Profile invites relations
   *
   * profileId, accessRoleId, and invitedBy are NOT NULL.
   */
  profileInvites: {
    profile: r.one.profiles({
      from: r.profileInvites.profileId,
      to: r.profiles.id,
      optional: false,
    }),
    accessRole: r.one.accessRoles({
      from: r.profileInvites.accessRoleId,
      to: r.accessRoles.id,
      optional: false,
    }),
    inviteeProfile: r.one.profiles({
      from: r.profileInvites.inviteeProfileId,
      to: r.profiles.id,
      alias: 'profileInvite_invitee',
    }),
    inviter: r.one.profiles({
      from: r.profileInvites.invitedBy,
      to: r.profiles.id,
      alias: 'profileInvite_inviter',
      optional: false,
    }),
  },

  /**
   * Profile users relations
   *
   * Links profile users to their assigned roles.
   */
  profileUsers: {
    roles: r.many.profileUserToAccessRoles({
      from: r.profileUsers.id,
      to: r.profileUserToAccessRoles.profileUserId,
    }),
  },

  /**
   * Profile user to access roles relations (join table)
   *
   * Links the join table to the actual access role.
   */
  profileUserToAccessRoles: {
    accessRole: r.one.accessRoles({
      from: r.profileUserToAccessRoles.accessRoleId,
      to: r.accessRoles.id,
      optional: false,
    }),
  },

  /**
   * Access role relations
   *
   * Links access roles to their zone permissions.
   */
  accessRoles: {
    zonePermissions: r.many.accessRolePermissionsOnAccessZones({
      from: r.accessRoles.id,
      to: r.accessRolePermissionsOnAccessZones.accessRoleId,
    }),
  },

  /**
   * Access role permissions on access zones relations (join table)
   *
   * Links the join table to the access role and access zone.
   */
  accessRolePermissionsOnAccessZones: {
    accessRole: r.one.accessRoles({
      from: r.accessRolePermissionsOnAccessZones.accessRoleId,
      to: r.accessRoles.id,
      optional: false,
    }),
    accessZone: r.one.accessZones({
      from: r.accessRolePermissionsOnAccessZones.accessZoneId,
      to: r.accessZones.id,
      optional: false,
    }),
  },

  /**
   * Organization relations
   *
   * profileId is NOT NULL.
   */
  organizations: {
    profile: r.one.profiles({
      from: r.organizations.profileId,
      to: r.profiles.id,
      optional: false,
    }),
    organizationUsers: r.many.organizationUsers({
      from: r.organizations.id,
      to: r.organizationUsers.organizationId,
    }),
    whereWeWork: r.many.organizationsWhereWeWork({
      from: r.organizations.id,
      to: r.organizationsWhereWeWork.organizationId,
    }),
    projects: r.many.projects({
      from: r.organizations.id,
      to: r.projects.organizationId,
    }),
    links: r.many.links({
      from: r.organizations.id,
      to: r.links.organizationId,
    }),
    strategies: r.many.organizationsStrategies({
      from: r.organizations.id,
      to: r.organizationsStrategies.organizationId,
    }),
  },

  /**
   * Organization user relations
   *
   * organizationId is NOT NULL. authUserId links to the service user.
   */
  organizationUsers: {
    organization: r.one.organizations({
      from: r.organizationUsers.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
    serviceUser: r.one.users({
      from: r.organizationUsers.authUserId,
      to: r.users.authUserId,
    }),
    roles: r.many.organizationUserToAccessRoles({
      from: r.organizationUsers.id,
      to: r.organizationUserToAccessRoles.organizationUserId,
    }),
  },

  /**
   * Organization user to access roles relations (join table)
   */
  organizationUserToAccessRoles: {
    organizationUser: r.one.organizationUsers({
      from: r.organizationUserToAccessRoles.organizationUserId,
      to: r.organizationUsers.id,
      optional: false,
    }),
    accessRole: r.one.accessRoles({
      from: r.organizationUserToAccessRoles.accessRoleId,
      to: r.accessRoles.id,
      optional: false,
    }),
  },

  /**
   * Organizations where we work relations (join table)
   */
  organizationsWhereWeWork: {
    organization: r.one.organizations({
      from: r.organizationsWhereWeWork.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
    location: r.one.locations({
      from: r.organizationsWhereWeWork.locationId,
      to: r.locations.id,
      optional: false,
    }),
  },

  /**
   * Organization relationship relations
   *
   * Self-referential edges between two organizations (source/target).
   */
  organizationRelationships: {
    sourceOrganization: r.one.organizations({
      from: r.organizationRelationships.sourceOrganizationId,
      to: r.organizations.id,
      alias: 'organizationRelationship_source',
      optional: false,
    }),
    targetOrganization: r.one.organizations({
      from: r.organizationRelationships.targetOrganizationId,
      to: r.organizations.id,
      alias: 'organizationRelationship_target',
      optional: false,
    }),
  },

  /**
   * Allow list relations
   */
  allowList: {
    organization: r.one.organizations({
      from: r.allowList.organizationId,
      to: r.organizations.id,
    }),
  },

  /**
   * Join profile requests relations
   */
  joinProfileRequests: {
    requestProfile: r.one.profiles({
      from: r.joinProfileRequests.requestProfileId,
      to: r.profiles.id,
      alias: 'joinProfileRequest_requestProfile',
      optional: false,
    }),
    targetProfile: r.one.profiles({
      from: r.joinProfileRequests.targetProfileId,
      to: r.profiles.id,
      alias: 'joinProfileRequest_targetProfile',
      optional: false,
    }),
  },

  /**
   * User relations
   *
   * profileId, currentProfileId, and lastOrgId are nullable.
   */
  users: {
    profile: r.one.profiles({
      from: r.users.profileId,
      to: r.profiles.id,
      alias: 'user_profile',
    }),
    currentProfile: r.one.profiles({
      from: r.users.currentProfileId,
      to: r.profiles.id,
      alias: 'user_currentProfile',
    }),
    currentOrganization: r.one.organizations({
      from: r.users.lastOrgId,
      to: r.organizations.id,
    }),
    organizationUsers: r.many.organizationUsers({
      from: r.users.authUserId,
      to: r.organizationUsers.authUserId,
    }),
    avatarImage: r.one.objectsInStorage({
      from: r.users.avatarImageId,
      to: r.objectsInStorage.id,
    }),
    authUser: r.one.authUsers({
      from: r.users.authUserId,
      to: r.authUsers.id,
      optional: false,
    }),
  },

  /**
   * Taxonomy relations
   *
   * taxonomyTerms has a self-referential parentId which breaks Drizzle inference.
   */
  taxonomies: {
    // @ts-expect-error - taxonomyTerms self-referential parentId breaks inference
    taxonomyTerms: r.many.taxonomyTerms({
      from: r.taxonomies.id,
      // @ts-expect-error - see above
      to: r.taxonomyTerms.taxonomyId,
    }),
  },

  /**
   * Taxonomy term relations
   */
  taxonomyTerms: {
    taxonomy: r.one.taxonomies({
      // @ts-expect-error - taxonomyTerms self-referential parentId breaks inference
      from: r.taxonomyTerms.taxonomyId,
      to: r.taxonomies.id,
    }),
  },
}));
