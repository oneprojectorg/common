import { cache } from '@op/cache';
import { NotFoundError, searchOrganizations } from '@op/common';
import { db } from '@op/db/client';
import { organizationUsers } from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { searchedOrganizationEncoder } from '../../encoders/organizations';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { dbFilter } from '../../utils';

export const searchOrganizationsRouter = router({
  search: commonAuthedProcedure()
    .input(
      dbFilter.extend({
        q: z.string(),
      }),
    )
    .output(z.array(searchedOrganizationEncoder))
    .query(async ({ ctx, input }) => {
      const { q, limit = 10 } = input;

      // Membership is fetched alongside the search (and kept outside the
      // search cache so it stays fresh when membership changes), letting the
      // UI disable orgs the user already belongs to before they try to join.
      const [result, membershipRows] = await Promise.all([
        cache<ReturnType<typeof searchOrganizations>>({
          type: 'search',
          params: [q, ctx.user.id],
          options: {
            ttl: 30 * 1000,
          },
          fetch: () =>
            searchOrganizations({
              query: q,
              limit,
            }),
        }),
        db
          .select({ organizationId: organizationUsers.organizationId })
          .from(organizationUsers)
          .where(eq(organizationUsers.authUserId, ctx.user.id)),
      ]);

      if (!result) {
        throw new NotFoundError('Organizations');
      }

      const memberOrgIds = new Set<unknown>(
        membershipRows.map((row) => row.organizationId),
      );

      return result.map((org) => {
        // TODO: Doing this to account for the difference in shape between on avatarImage
        // which here is rendered even if it is null (with all null values)
        // @ts-expect-error
        if (org.profile.avatarImage.id == null) {
          // @ts-expect-error
          org.profile.avatarImage = null;
        }
        return searchedOrganizationEncoder.parse({
          org,
          isMember: memberOrgIds.has(org.id),
        });
      });
    }),
});
