import { mergeRouters } from '../../trpcFactory';

import { getOrganizationRouter } from './getOrganization';
import { listOrganizationsRouter } from './listOrganizations';
import { listOrganizationPostsRouter } from './listPosts';

export const organizationRouter = mergeRouters(
  getOrganizationRouter,
  listOrganizationsRouter,
  listOrganizationPostsRouter,
);
