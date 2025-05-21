import { db, eq, sql } from '@op/db/client';
import {
  links,
  organizationUserToAccessRoles,
  organizationUsers,
  organizations,
  organizationsStrategies,
  organizationsTerms,
  organizationsWhereWeWork,
  taxonomyTerms,
  users,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { randomUUID } from 'crypto';
import { z } from 'zod';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';

export const geoNamesDataSchema = z
  .object({
    toponymName: z.string(),
    name: z.string(),
    lat: z.number(),
    lng: z.number(),
    geonameId: z.number(),
    countryCode: z.string(),
    countryName: z.string(),
    fcl: z.string(),
    fcode: z.string(),
  })
  .partial()
  .strip();

const whereWeWorkSchema = z
  .object({ id: z.string(), label: z.string(), data: geoNamesDataSchema })
  .partial()
  .strip();

export const organizationInputSchema = z
  .object({
    slug: z.string(),
    email: z.string().email(),
    name: z.string().optional(),
    bio: z.string().optional(),
    isOfferingFunds: z.boolean().optional(),
    isReceivingFunds: z.boolean().optional(),
    website: z.string().optional(),
    mission: z.string().optional(),

    headerImageId: z.string().optional(),
    avatarImageId: z.string().optional(),
    whereWeWork: z.array(whereWeWorkSchema),
    strategies: z.array(
      z.object({
        id: z.string(),
      }),
    ),
    focusAreas: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
      }),
    ),
    communitiesServed: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
        }),
      )
      .optional(),
  })
  .strip()
  .partial();

type OrganizationInput = z.infer<typeof organizationInputSchema>;

const OrganizationInputParser = organizationInputSchema.transform(
  (data: OrganizationInput) => {
    // Remove keys with undefined values
    return Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined),
    ) as OrganizationInput;
  },
);

export const fundingLinksInputSchema = z
  .object({
    receivingFundsDescription: z.string().optional(),
    receivingFundsLink: z
      .string()
      .url({ message: 'Enter a valid website address' })
      .optional(),
    offeringFundsDescription: z.string().optional(),
    offeringFundsLink: z
      .string()
      .url({ message: 'Enter a valid website address' })
      .optional(),
  })
  .strip()
  .partial();
type FundingLinksInput = z.infer<typeof fundingLinksInputSchema>;

// const upsertTaxonomyTerms = async ({
// tx,
// terms,
// taxonomyName,
// }: {
// tx: TransactionType;
// terms: Array<{ id?: string; label: string }>;
// taxonomyName: string;
// }) => {
// const [name, facet] = taxonomyName.split(':');

// // retrieve the taxonomy so we can grab the id
// const taxonomy = await tx.query.taxonomies.findFirst({
// where: () => eq(taxonomies.name, name ?? taxonomyName),
// });

// if (!taxonomy) {
// return undefined;
// }

// // upsert all terms attached to the taxonomy
// const addedTerms = await Promise.all(
// terms.map(async (externalTerm) => {
// // upsert the terms

// const [term] = await tx
// .insert(taxonomyTerms)
// .values({
// taxonomyId: taxonomy.id,
// label: externalTerm.label,
// facet,
// termUri: `${taxonomy.name}:${externalTerm.id}`,
// // data: externalTerm.data,
// })
// // just update in case we have new info from the API
// .onConflictDoUpdate({
// target: [taxonomyTerms.termUri, taxonomyTerms.taxonomyId],
// set: {
// // set the existing value. This is so we can get the value back without an extra call
// label: sql`excluded.label`,
// },
// })
// .returning();

// return term;
// }),
// );

// return what we have added so those can be linked to the record
// return addedTerms.filter((term) => term !== undefined);
// };

export const createOrganization = async ({
  data,
  user,
}: {
  data: OrganizationInput &
    FundingLinksInput & {
      orgAvatarImageId?: string;
      orgBannerImageId?: string;
    };
  user: User;
}) => {
  if (!user) {
    throw new UnauthorizedError();
  }

  const orgInputs = OrganizationInputParser.parse({
    slug: randomUUID(),
    email: user.email,
    ...data,
    headerImageId: data.orgBannerImageId,
    avatarImageId: data.orgAvatarImageId,
  });

  // Create organization and link user
  const result = await db.transaction(async (tx) => {
    const [newOrg] = await tx
      .insert(organizations)
      // @ts-expect-error - TODO: this is well defined with zod
      .values(orgInputs)
      .returning();

    if (!newOrg) {
      throw new NotFoundError('Failed to create organization');
    }

    // Insert organizationUser linking the user to organization, with a default role of owner
    const [[newOrgUser], adminRole] = await Promise.all([
      tx
        .insert(organizationUsers)
        .values({
          organizationId: newOrg.id,
          authUserId: user.id,
          email: user.email!,
        })
        .returning(),
      tx.query.accessRoles.findFirst({
        where: (table, { eq }) => eq(table.name, 'Admin'),
      }),
      tx
        .update(users)
        .set({ lastOrgId: newOrg.id })
        .where(eq(users.authUserId, user.id)),
    ]);

    // Add admin role to the user creating the organization
    if (adminRole && newOrgUser) {
      await tx.insert(organizationUserToAccessRoles).values({
        organizationUserId: newOrgUser.id,
        accessRoleId: adminRole.id,
      });
    }

    // Add funding links
    await Promise.all([
      ...(data.receivingFundsLink
        ? [
            tx.insert(links).values({
              organizationId: newOrg.id,
              href: data.receivingFundsLink,
              description: data.receivingFundsDescription,
              type: 'receiving',
            }),
          ]
        : []),
      ...(data.offeringFundsLink
        ? [
            tx.insert(links).values({
              organizationId: newOrg.id,
              href: data.offeringFundsLink,
              description: data.offeringFundsDescription,
              type: 'offering',
            }),
          ]
        : []),
    ]);

    // Add where we work geoNames
    const geoNames =
      data.whereWeWork?.map((whereWeWork) =>
        whereWeWork.data
          ? geoNamesDataSchema.parse(whereWeWork.data)
          : {
              geonameId: `custom-${whereWeWork.label}`,
              name: whereWeWork.label,
            },
      ) || [];

    const geoNamesTaxonomy = await tx.query.taxonomies.findFirst({
      where: (table, { eq, and }) =>
        and(
          eq(table.name, 'geoNames'),
          eq(table.namespaceUri, 'https://www.geonames.org/ontology'),
        ),
    });

    if (geoNamesTaxonomy) {
      await Promise.all(
        geoNames.map(async (geoName) => {
          // make sure we have a valid ID
          if (geoName.geonameId) {
            // upsert the terms
            const [term] = await tx
              .insert(taxonomyTerms)
              .values({
                taxonomyId: geoNamesTaxonomy.id,
                label: geoName.name,
                termUri: geoName.geonameId.toString(),
                data: geoName,
              })
              // just update in case we have new info from the API
              .onConflictDoUpdate({
                target: [taxonomyTerms.termUri, taxonomyTerms.taxonomyId],
                set: {
                  // set the existing value. This is so we can get the value back without an extra call
                  label: sql`excluded.label`,
                },
              })
              .returning();

            await tx
              .insert(organizationsWhereWeWork)
              .values({
                organizationId: newOrg.id,
                taxonomyTermId: term.id,
              })
              .onConflictDoNothing();
          }
        }),
      );
    }

    const { focusAreas, strategies, communitiesServed } = data;

    // add in focus areas
    if (focusAreas) {
      await Promise.all(
        focusAreas.map((term) =>
          tx
            .insert(organizationsTerms)
            .values({
              organizationId: newOrg.id,
              taxonomyTermId: term.id,
            })
            .onConflictDoNothing(),
        ),
      );
    }

    // add all stategy terms to the org (strategy terms already exist in the DB)
    // TODO: parallelize this

    if (strategies) {
      await Promise.all(
        strategies.map((strategy) =>
          tx
            .insert(organizationsStrategies)
            .values({
              organizationId: newOrg.id,
              taxonomyTermId: strategy.id,
            })
            .onConflictDoNothing(),
        ),
      );
    }

    if (communitiesServed) {
      await Promise.all(
        communitiesServed.map((term) =>
          tx
            .insert(organizationsTerms)
            .values({
              organizationId: newOrg.id,
              taxonomyTermId: term.id,
            })
            .onConflictDoNothing(),
        ),
      );
    }

    if (!newOrgUser) {
      throw new CommonError('Failed to associate organization with user');
    }

    return newOrg;
  });

  return result;
};
