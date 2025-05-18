import { db, eq } from '@op/db/client';
import { organizationsTerms, taxonomies, taxonomyTerms } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError } from '../../utils';

export const getOrganizationTerms = async ({
  organizationId,
  user,
}: {
  user: User;
  termUri?: string;
  organizationId: string;
}) => {
  if (!user) {
    throw new UnauthorizedError();
  }

  try {
    const orgTerms = await db
      .select({
        termUri: taxonomyTerms.termUri,
        taxonomyUri: taxonomies.namespaceUri,
        id: taxonomyTerms.id,
        label: taxonomyTerms.label,
        facet: taxonomyTerms.facet,
      })
      .from(organizationsTerms)
      .leftJoin(
        taxonomyTerms,
        eq(taxonomyTerms.id, organizationsTerms.taxonomyTermId),
      )
      .leftJoin(taxonomies, eq(taxonomies.id, taxonomyTerms.taxonomyId))
      .where(eq(organizationsTerms.organizationId, organizationId))
      .execute();

    if (!orgTerms) {
      throw new NotFoundError('Could not get organization terms');
    }

    const termUris = orgTerms.reduce(
      (accum, term) => {
        const key = `${term.taxonomyUri}${term.facet ? `:${term.facet}` : ''}`;
        if (!accum[key]) {
          accum[key] = [];
        }

        accum[key].push(term);

        return accum;
      },
      {} as Record<string, typeof orgTerms>,
    );

    return termUris;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
