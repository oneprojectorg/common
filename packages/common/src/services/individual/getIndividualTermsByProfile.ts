import { db, eq } from '@op/db/client';
import {
  individuals,
  individualsTerms,
  taxonomies,
  taxonomyTerms,
} from '@op/db/schema';

export const getIndividualTermsByProfile = async ({
  profileId,
}: {
  profileId: string;
}) => {
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
      .leftJoin(individuals, eq(individuals.id, individualsTerms.individualId))
      .leftJoin(
        taxonomyTerms,
        eq(taxonomyTerms.id, individualsTerms.taxonomyTermId),
      )
      .leftJoin(taxonomies, eq(taxonomies.id, taxonomyTerms.taxonomyId))
      .where(eq(individuals.profileId, profileId))
      .execute();

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
