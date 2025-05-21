import { mergeRouters } from '../../trpcFactory';
import { addRelationshipRouter } from './addRelationship';
import { approveRelationshipRouter } from './approveRelationship';
import { createOrganizationRouter } from './createOrganization';
import { createPostInOrganization } from './createPostInOrganization';
import { declineRelationshipRouter } from './declineRelationship';
import { getOrganizationRouter } from './getOrganization';
import { listOrganizationsRouter } from './listOrganizations';
import { listOrganizationPostsRouter } from './listPosts';
import { listRelatedOrganizationPostsRouter } from './listRelatedOrganizationPosts';
import { listRelationshipsRouter } from './listRelationships';
import { removeRelationshipRouter } from './removeRelationship';
import { organizationStatsRouter } from './stats';
import { uploadAvatarImage } from './uploadAvatarImage';

export const organizationRouter = mergeRouters(
  getOrganizationRouter,
  listOrganizationsRouter,
  listOrganizationPostsRouter,
  createPostInOrganization,
  createOrganizationRouter,
  uploadAvatarImage,
  addRelationshipRouter,
  approveRelationshipRouter,
  declineRelationshipRouter,
  listRelationshipsRouter,
  removeRelationshipRouter,
  organizationStatsRouter,
  listRelatedOrganizationPostsRouter,
);
