import { mergeRouters } from '../../trpcFactory';
import { addRelationshipRouter } from './addRelationship';
import { createOrganizationRouter } from './createOrganization';
import { createPostInOrganization } from './createPostInOrganization';
import { getOrganizationRouter } from './getOrganization';
import { listOrganizationsRouter } from './listOrganizations';
import { listOrganizationPostsRouter } from './listPosts';
import { listRelationshipsRouter } from './listRelationships';
import { uploadAvatarImage } from './uploadAvatarImage';

export const organizationRouter = mergeRouters(
  getOrganizationRouter,
  listOrganizationsRouter,
  listOrganizationPostsRouter,
  createPostInOrganization,
  createOrganizationRouter,
  uploadAvatarImage,
  addRelationshipRouter,
  listRelationshipsRouter,
);
