import { db } from '@op/db/client';
import {
  links,
  organizationUsers,
  organizations,
  organizationsWhereWeWork,
  taxonomyTerms,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { randomUUID } from 'crypto';
import { z } from 'zod';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';

export const getOrganization = async ({
  slug,
  id,
  user,
}: { user: User } & (
  | { id: string; slug?: undefined }
  | { id?: undefined; slug: string }
)) => {
  if (!user) {
    throw new UnauthorizedError();
  }

  if (!slug && !id) {
    return;
  }

  // assertAccess({ organization, permission: 'read' }, user.roles);

  const result = await db.query.organizations.findFirst({
    where: slug
      ? (table, { eq }) => eq(table.slug, slug)
      : (table, { eq }) => eq(table.id, id!),
    with: {
      projects: true,
      links: true,
      headerImage: true,
      avatarImage: true,
    },
  });

  return result;
};

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
  .object({ data: geoNamesDataSchema })
  .partial()
  .strip();

export const organizationInputSchema = z
  .object({
    slug: z.string(),
    email: z.string().email(),
    name: z.string().optional(),
    isOfferingFunds: z.boolean().optional(),
    isReceivingFunds: z.boolean().optional(),
    website: z.string().url().optional(),
    mission: z.string().optional(),

    headerImageId: z.string().optional(),
    avatarImageId: z.string().optional(),
    whereWeWork: z.array(whereWeWorkSchema),
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

export const fundingLinksnputSchema = z
  .object({
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
type FundingLinksInput = z.infer<typeof fundingLinksnputSchema>;

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
    const [newOrgUser] = await tx
      .insert(organizationUsers)
      .values({
        organizationId: newOrg.id,
        authUserId: user.id,
        email: user.email!,
      })
      .returning();

    // Add funding links
    await Promise.all([
      ...(data.receivingFundsLink
        ? [
            tx.insert(links).values({
              organizationId: newOrg.id,
              href: data.receivingFundsLink,
              type: 'receiving',
            }),
          ]
        : []),
      ...(data.offeringFundsLink
        ? [
            tx.insert(links).values({
              organizationId: newOrg.id,
              href: data.offeringFundsLink,
              type: 'offering',
            }),
          ]
        : []),
    ]);

    // Add where we work geoNames
    const geoNames =
      data.whereWeWork?.map((whereWeWork) =>
        geoNamesDataSchema.parse(whereWeWork.data),
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
            // add the terms
            const [term] = await tx
              .insert(taxonomyTerms)
              .values({
                taxonomyId: geoNamesTaxonomy.id,
                label: geoName.name,
                termUri: geoName.geonameId.toString(),
                data: geoName,
              })
              .onConflictDoNothing()
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

    if (!newOrgUser) {
      throw new CommonError('Failed to associate organization with user');
    }

    return newOrg;
  });

  return result;
};
