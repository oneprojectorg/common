import { db, eq, sql } from '@op/db/client';
import {
  links,
  locations,
  organizationUserToAccessRoles,
  organizationUsers,
  organizations,
  organizationsStrategies,
  organizationsTerms,
  organizationsWhereWeWork,
  profiles,
  users,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { randomUUID } from 'crypto';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import {
  type FundingLinksInput,
  type OrganizationInput,
  OrganizationInputParser,
  geoNamesDataSchema,
} from './validators';

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
const broadDomains = [
  'facebook.com',
  'twitter.com',
  'linkedin.com',
  'bsky.app',
  'mastodon.social',
  'gmail.com',
  'outlook.com',
  'hotmail.com',
];

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
    ...data,
    profileId: null,
  });

  let domain: string | undefined;
  if (data.website) {
    try {
      let val = data.website;
      if (val && !val.startsWith('http://') && !val.startsWith('https://')) {
        val = `https://${val}`;
      }
      const fullDomain = new URL(val);
      domain = fullDomain.hostname.toLowerCase();
      if (
        domain &&
        broadDomains.some((broad) => domain?.match(new RegExp(broad)))
      ) {
        domain = undefined;
      }
    } catch (e) {
      console.error('Could not parse hostname', e);
    }
  }

  // Create an org profile
  const [profile] = await db
    .insert(profiles)
    .values({
      name: data.name! ?? 'New Organization',
      slug: randomUUID(),
      email: data.email,
      bio: data.bio,
      website: data.website,
      mission: data.mission,
      headerImageId: data.orgBannerImageId,
      avatarImageId: data.orgAvatarImageId,
    })
    .returning();

  if (!profile) {
    throw new CommonError('Failed to create profile');
  }

  const [newOrg] = await db
    .insert(organizations)
    .values({
      ...orgInputs,
      profileId: profile.id,
      domain,
    })
    .returning();

  if (!newOrg) {
    throw new NotFoundError('Failed to create organization');
  }

  // Insert organizationUser linking the user to organization, with a default role of owner
  const [[newOrgUser], adminRole] = await Promise.all([
    db
      .insert(organizationUsers)
      .values({
        organizationId: newOrg.id,
        authUserId: user.id,
        email: user.email!,
      })
      .returning(),
    db.query.accessRoles.findFirst({
      where: (table, { eq }) => eq(table.name, 'Admin'),
    }),
    db
      .update(users)
      .set({ 
        // Keep lastOrgId for backwards compatibility
        lastOrgId: newOrg.id, 
        currentProfileId: profile.id 
      })
      .where(eq(users.authUserId, user.id)),
  ]);

  // Add admin role to the user creating the organization
  if (!(adminRole && newOrgUser)) {
    throw new CommonError('Failed to create organization');
  }

  await db.insert(organizationUserToAccessRoles).values({
    organizationUserId: newOrgUser.id,
    accessRoleId: adminRole.id,
  });

  try {
    // Add funding links
    await Promise.all([
      ...(data.receivingFundsLink
        ? [
            db.insert(links).values({
              organizationId: newOrg.id,
              href: data.receivingFundsLink,
              description: data.receivingFundsDescription,
              type: 'receiving',
            }),
          ]
        : []),
      ...(data.offeringFundsLink
        ? [
            db.insert(links).values({
              organizationId: newOrg.id,
              href: data.offeringFundsLink,
              description: data.offeringFundsDescription,
              type: 'offering',
            }),
          ]
        : []),
    ]);

    // Add where we work locations using Google Places data
    if (data.whereWeWork?.length) {
      await Promise.all(
        data.whereWeWork.map(async (whereWeWork) => {
          const geoData = whereWeWork.data
            ? geoNamesDataSchema.parse(whereWeWork.data)
            : null;

          // Create location record
          const [location] = await db
            .insert(locations)
            .values({
              name: whereWeWork.label,
              placeId: geoData?.geonameId?.toString() ?? randomUUID(),
              address: geoData?.toponymName,
              location:
                geoData?.lat && geoData?.lng
                  ? sql`ST_SetSRID(ST_MakePoint(${geoData.lng}, ${geoData.lat}), 4326)`
                  : undefined,
              countryCode: geoData?.countryCode,
              countryName: geoData?.countryName,
              metadata: geoData,
            })
            .onConflictDoUpdate({
              target: [locations.placeId],
              set: {
                name: sql`excluded.name`,
                address: sql`excluded.address`,
                // location: sql`excluded.location`,
                countryCode: sql`excluded.country_code`,
                countryName: sql`excluded.country_name`,
                metadata: sql`excluded.metadata`,
              },
            })
            .returning();

          if (location) {
            // Link location to organization
            await db
              .insert(organizationsWhereWeWork)
              .values({
                organizationId: newOrg.id,
                locationId: location.id,
              })
              .onConflictDoNothing();
          }
        }),
      );
    }

    const {
      focusAreas,
      strategies,
      communitiesServed,
      receivingFundsTerms,
      offeringFundsTerms,
    } = data;

    // add all stategy terms to the org (strategy terms already exist in the DB)
    // TODO: parallelize this

    if (strategies) {
      await Promise.all(
        strategies.map((strategy) =>
          db
            .insert(organizationsStrategies)
            .values({
              organizationId: newOrg.id,
              taxonomyTermId: strategy.id,
            })
            .onConflictDoNothing(),
        ),
      );
    }

    // TODO: this was changed quickly in the process. We are transitioning to this way of doing terms.
    if (
      focusAreas ||
      communitiesServed ||
      receivingFundsTerms ||
      offeringFundsTerms
    ) {
      const terms = [
        ...(communitiesServed ?? []),
        ...(receivingFundsTerms ?? []),
        ...(offeringFundsTerms ?? []),
        ...(focusAreas ?? []),
      ];

      await Promise.all(
        terms.map((term) =>
          db
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

    // @ts-ignore
    return { ...newOrg, profile };
  } catch (e) {
    console.error(e);
    throw new CommonError('Failed to create organization');
  }
};
