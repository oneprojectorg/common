import { mergeRouters } from '../../trpcFactory';
import { addRelationshipRouter } from './addRelationship';
import { approveRelationshipRouter } from './approveRelationship';
import { createOrganizationRouter } from './createOrganization';
import { createPostInOrganization } from './createPostInOrganization';
import { declineRelationshipRouter } from './declineRelationship';
import { deletePost } from './deletePost';
import { getOrganizationRouter } from './getOrganization';
import { getOrganizationsByProfileRouter } from './getOrganizationsByProfile';
import { inviteUserRouter } from './inviteUser';
import { joinOrganization } from './joinOrganization';
import { listOrganizationsRouter } from './listOrganizations';
import { listOrganizationPostsRouter } from './listPosts';
import { listRelatedOrganizationPostsRouter } from './listRelatedOrganizationPosts';
import { listRelationshipsRouter } from './listRelationships';
import { reactionsRouter } from './reactions';
import { removeRelationshipRouter } from './removeRelationship';
import { searchOrganizationsRouter } from './searchOrganizations';
import { organizationStatsRouter } from './stats';
import { updateOrganizationRouter } from './updateOrganization';
import { uploadAvatarImage } from './uploadAvatarImage';
import { uploadPostAttachment } from './uploadPostAttachment';

export const organizationRouter = mergeRouters(
  getOrganizationRouter,
  getOrganizationsByProfileRouter,
  listOrganizationsRouter,
  listOrganizationPostsRouter,
  searchOrganizationsRouter,
  createPostInOrganization,
  deletePost,
  createOrganizationRouter,
  updateOrganizationRouter,
  uploadAvatarImage,
  uploadPostAttachment,
  addRelationshipRouter,
  approveRelationshipRouter,
  declineRelationshipRouter,
  listRelationshipsRouter,
  removeRelationshipRouter,
  organizationStatsRouter,
  listRelatedOrganizationPostsRouter,
  joinOrganization,
  inviteUserRouter,
  reactionsRouter,
);
