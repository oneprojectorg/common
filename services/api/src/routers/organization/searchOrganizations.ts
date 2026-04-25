import { cache } from '@op/cache';
import { NotFoundError, searchOrganizations } from '@op/common';
import { db } from '@op/db/client';
import { organizationUsers } from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { organizationsEncoder } from '../../encoders/organizations';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { dbFilter } from '../../utils';

const searchResultEncoder = organizationsEncoder.extend({
  isCurrentMember: z.boolean(),
});

export const searchOrganizationsRouter = router({
  search: commonAuthedProcedure()
    .input(
      dbFilter.extend({
        q: z.string(),
      }),
    )
    .output(z.array(searchResultEncoder))
    .query(async ({ ctx, input }) => {
      const { q, limit = 10 } = input;

      // Each result carries an isCurrentMember flag (kept outside the search
      // cache so it stays fresh when membership changes), letting the UI
      // disable orgs the user already belongs to before they try to join.
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
        return searchResultEncoder.parse({
          ...org,
          isCurrentMember: memberOrgIds.has(org.id),
        });
      });
    }),
});
