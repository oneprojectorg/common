import { cache } from '@op/cache';
import {
  UnauthorizedError,
  getOrganization,
  getOrganizationTerms,
} from '@op/common';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { Profile } from '../../encoders';
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

      try {
        const result = await cache({
          type: 'organization',
          params: [slug],
          fetch: () => getOrganization({ slug }),
        });

        if (!result) {
          throw new TRPCError({
            message: 'Organization not found',
            code: 'NOT_FOUND',
          });
        }

        // Transform profile modules to simplified format
        const transformedResult = {
          ...result,
          profile: {
            ...result.profile,
            // type assertion to be fixed with Drizzle RQB v2
            modules: (result.profile as Profile).modules?.map(
              (profileModule: any) => ({
                slug: profileModule.module.slug,
              }),
            ),
          },
        };

        return organizationsWithProfileEncoder.parse(transformedResult);
      } catch (error: unknown) {
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: 'You do not have acess to this organization',
            code: 'UNAUTHORIZED',
          });
        }

        throw new TRPCError({
          message: 'Organization not found',
          code: 'NOT_FOUND',
        });
      }
    }),
  getTerms: commonAuthedProcedure()
    .input(z.object({ id: z.string(), termUri: z.string().optional() }))
    .output(organizationsTermsEncoder)
    .query(async ({ input }) => {
      const { id } = input;
      try {
        const result = await getOrganizationTerms({
          organizationId: id,
        });

        if (!result) {
          throw new TRPCError({
            message: 'Organization terms not found',
            code: 'NOT_FOUND',
          });
        }

        return organizationsTermsEncoder.parse(result);
      } catch (error: unknown) {
        console.log(error);
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: 'You do not have acess to this organization',
            code: 'UNAUTHORIZED',
          });
        }

        throw new TRPCError({
          message: 'Organization terms not found',
          code: 'NOT_FOUND',
        });
      }
    }),
});
