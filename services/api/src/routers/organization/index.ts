import { mergeRouters } from '../../trpcFactory';
import { addRelationshipRouter } from './addRelationship';
import { approveRelationshipRouter } from './approveRelationship';
import { checkMembershipRouter } from './checkMembership';
import { createOrganizationRouter } from './createOrganization';
import { createPostInOrganizationRouter } from './createPostInOrganization';
import { declineRelationshipRouter } from './declineRelationship';
import { deleteOrganizationUserRouter } from './deleteOrganizationUser';
import { deletePost } from './deletePost';
import { getOrganizationRouter } from './getOrganization';
import { getOrganizationsByProfileRouter } from './getOrganizationsByProfile';
import { getRolesRouter } from './getRoles';
import { inviteUserRouter } from './inviteUser';
import { joinOrganization } from './joinOrganization';
import { listOrganizationsRouter } from './listOrganizations';
import { listOrganizationPostsRouter } from './listPosts';
import { listRelatedOrganizationPostsRouter } from './listRelatedOrganizationPosts';
import { listRelationshipsRouter } from './listRelationships';
import { listUsersRouter } from './listUsers';
import { reactionsRouter } from './reactions';
import { removeRelationshipRouter } from './removeRelationship';
import { searchOrganizationsRouter } from './searchOrganizations';
import { updateOrganizationRouter } from './updateOrganization';
import { updateOrganizationUserRouter } from './updateOrganizationUser';
import { uploadAvatarImage } from './uploadAvatarImage';

export const organizationRouter = mergeRouters(
  getOrganizationRouter,
  getOrganizationsByProfileRouter,
  getRolesRouter,
  listOrganizationsRouter,
  listUsersRouter,
  listOrganizationPostsRouter,
  searchOrganizationsRouter,
  createPostInOrganizationRouter,
  deletePost,
  createOrganizationRouter,
  updateOrganizationRouter,
  uploadAvatarImage,
  addRelationshipRouter,
  approveRelationshipRouter,
  declineRelationshipRouter,
  listRelationshipsRouter,
  removeRelationshipRouter,
  listRelatedOrganizationPostsRouter,
  joinOrganization,
  inviteUserRouter,
  checkMembershipRouter,
  reactionsRouter,
  updateOrganizationUserRouter,
  deleteOrganizationUserRouter,
);
