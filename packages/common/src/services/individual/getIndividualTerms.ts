import { db, eq } from '@op/db/client';
import { individualsTerms, taxonomies, taxonomyTerms } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError } from '../../utils';

export const getIndividualTerms = async ({
  individualId,
  user,
}: {
  user: User;
  termUri?: string;
  individualId: string;
}) => {
  if (!user) {
    throw new UnauthorizedError();
  }

  try {
    const indTerms = await db
      .select({
        termUri: taxonomyTerms.termUri,
        taxonomyUri: taxonomies.namespaceUri,
        id: taxonomyTerms.id,
        label: taxonomyTerms.label,
        facet: taxonomyTerms.facet,
      })
      .from(individualsTerms)
      .leftJoin(
        taxonomyTerms,
        eq(taxonomyTerms.id, individualsTerms.taxonomyTermId),
      )
      .leftJoin(taxonomies, eq(taxonomies.id, taxonomyTerms.taxonomyId))
      .where(eq(individualsTerms.individualId, individualId))
      .execute();

    if (!indTerms) {
      throw new NotFoundError('Could not get individual terms');
    }

    const termUris = indTerms.reduce(
      (accum, term) => {
        const key = `${term.taxonomyUri}${term.facet ? `:${term.facet}` : ''}`;
        if (!accum[key]) {
          accum[key] = [];
        }

        accum[key].push(term);

        return accum;
      },
      {} as Record<string, typeof indTerms>,
    );

    return termUris;
  } catch (error) {
    console.error(error);
    throw error;
  }
};