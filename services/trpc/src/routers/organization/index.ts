import { mergeRouters } from '../../trpcFactory';

import { getOrganizationRouter } from './getOrganization';
import { listOrganizationsRouter } from './listOrganizations';

export const organizationRouter = mergeRouters(
  getOrganizationRouter,
  listOrganizationsRouter,
);
