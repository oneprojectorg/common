import { cache } from '@op/cache';
import { getOrganization, getOrganizationTerms } from '@op/common';
import { z } from 'zod';

import {
  organizationsTermsEncoder,
  organizationsWithProfileEncoder,
} from '../../encoders/organizations';
import { commonAuthedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  slug: z.string(),
});

export const getOrganizationRouter = router({
  getBySlug: commonAuthedProcedure()
    .input(inputSchema)
    .output(organizationsWithProfileEncoder)
    .query(async ({ input }) => {
      const { slug } = input;

      const result = await cache({
        type: 'organization',
        params: [slug],
        fetch: () => getOrganization({ slug }),
      });

      return organizationsWithProfileEncoder.parse(result);
    }),
  getTerms: commonAuthedProcedure()
    .input(z.object({ id: z.string(), termUri: z.string().optional() }))
    .output(organizationsTermsEncoder)
    .query(async ({ input }) => {
      const { id } = input;

      const result = await getOrganizationTerms({
        organizationId: id,
      });

      return organizationsTermsEncoder.parse(result);
    }),
});
