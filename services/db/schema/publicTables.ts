// Public tables are included in migrations
export { accessRoles } from './tables/access.sql';
export { 
  accessZones, 
  accessZonesRelations,
  accessRolePermissionsOnAccessZones,
  accessRolePermissionsOnAccessZonesRelations
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
} from './tables/relationships.sql';
export { users, usersRelations } from './tables/users.sql';
export { usersUsedStorage } from './tables/usersUsedStorage.sql';
export { locations } from './tables/locations.sql';
export { profiles, profilesRelations } from './tables/profiles.sql';
export type { Profile } from './tables/profiles.sql';
export { EntityType, entityTypeEnum } from './tables/entities.sql';
export { allowList, allowListRelations } from './tables/allowList.sql';

export type { ObjectsInStorage } from './tables/storage.sql';
