import { db, eq, sql } from '@op/db/client';
import {
  links,
  locations,
  organizations,
  organizationsStrategies,
  organizationsTerms,
  organizationsWhereWeWork,
  profiles,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import pMap from 'p-map';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { getOrgAccessUser } from '../access';
import {
  type FundingLinksInput,
  type UpdateOrganizationInput,
  UpdateOrganizationInputParser,
} from './validators';

export const updateOrganization = async ({
  id,
  data,
  user,
}: {
  id: string;
  data: UpdateOrganizationInput &
    FundingLinksInput & {
      orgAvatarImageId?: string;
      orgBannerImageId?: string;
    };
  user: User;
}) => {
  const organizationId = id;
  const orgUser = await getOrgAccessUser({ user, organizationId });

  if (!orgUser) {
    throw new UnauthorizedError('You are not a member of this organization');
  }

  const { ...updateData } = data;

  if (!organizationId) {
    throw new CommonError('Organization ID is required');
  }

  // Check if user has permission to update this organization
  const existingOrg = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!existingOrg) {
    throw new NotFoundError('Organization not found');
  }

  const orgInputs = UpdateOrganizationInputParser.parse(updateData);

  // Update organization
  const [orgToUpdate] = await db
    .update(organizations)
    .set(orgInputs)
    .where(eq(organizations.id, organizationId))
    .returning();

  if (!orgToUpdate) {
    throw new NotFoundError('Failed to update organization');
  }

  // Loop through changes concurrently
  await pMap(
    [
      async () => {
        // Update profile with relevant fields
        const profileFields = Object.fromEntries(
          Object.entries(data).filter(
            ([key, value]) => value !== undefined && key !== 'id',
          ),
        );

        // Only update profile if there are fields to update
        if (Object.keys(profileFields).length > 0) {
          await db
            .update(profiles)
            .set({
              ...profileFields,
              headerImageId: data.orgBannerImageId,
              avatarImageId: data.orgAvatarImageId,
            })
            .where(eq(profiles.id, orgToUpdate.profileId));
        }
      },
      async () => {
        // Update funding links if provided
        if (
          data.receivingFundsLink !== undefined ||
          data.offeringFundsLink !== undefined
        ) {
          await db.transaction(async (tx) => {
            // Remove existing funding links
            await tx
              .delete(links)
              .where(eq(links.organizationId, organizationId));

            // Add new funding links
            await Promise.all([
              ...(data.receivingFundsLink
                ? [
                    tx.insert(links).values({
                      organizationId: orgToUpdate.id,
                      href: data.receivingFundsLink,
                      description: data.receivingFundsDescription,
                      type: 'receiving',
                    }),
                  ]
                : []),
              ...(data.offeringFundsLink
                ? [
                    tx.insert(links).values({
                      organizationId: orgToUpdate.id,
                      href: data.offeringFundsLink,
                      description: data.offeringFundsDescription,
                      type: 'offering',
                    }),
                  ]
                : []),
            ]);
          });
        }
      },
      async () => {
        // Update where we work locations if provided
        if (data.whereWeWork !== undefined) {
          await db.transaction(async (tx) => {
            if (data.whereWeWork == undefined) {
              return;
            }

            // Remove existing where we work entries
            await tx
              .delete(organizationsWhereWeWork)
              .where(
                eq(organizationsWhereWeWork.organizationId, organizationId),
              );

            if (data.whereWeWork.length > 0) {
              await Promise.all(
                data.whereWeWork.map(async (whereWeWork) => {
                  // Create location record
                  const [location] = await tx
                    .insert(locations)
                    .values({
                      name: whereWeWork.data.name,
                      placeId: whereWeWork.data.placeId,
                      address: whereWeWork.data.address,
                      location:
                        whereWeWork.data?.lat && whereWeWork.data?.lng
                          ? sql`ST_SetSRID(ST_MakePoint(${whereWeWork.data.lng}, ${whereWeWork.data.lat}), 4326)`
                          : undefined,
                      countryCode: whereWeWork.data.countryCode,
                      countryName: whereWeWork.data.countryName,
                      metadata: whereWeWork.data,
                    })
                    .onConflictDoUpdate({
                      target: [locations.placeId],
                      set: {
                        name: sql`excluded.name`,
                        address: sql`excluded.address`,
                        location: sql`excluded.location`,
                        countryCode: sql`excluded.country_code`,
                        countryName: sql`excluded.country_name`,
                        metadata: sql`excluded.metadata`,
                      },
                    })
                    .returning();

                  if (location) {
                    // Link location to organization
                    await tx
                      .insert(organizationsWhereWeWork)
                      .values({
                        organizationId: orgToUpdate.id,
                        locationId: location.id,
                      })
                      .onConflictDoNothing();
                  }
                }),
              );
            }
          });
        }
      },

      async () => {
        // Update focus areas if provided
        // Remove existing focus areas
        await db.transaction(async (tx) => {
          if (data.focusAreas !== undefined) {
            await tx
              .delete(organizationsTerms)
              .where(eq(organizationsTerms.organizationId, organizationId));

            if (data.focusAreas.length > 0) {
              await Promise.all(
                data.focusAreas.map((term) =>
                  tx
                    .insert(organizationsTerms)
                    .values({
                      organizationId: orgToUpdate.id,
                      taxonomyTermId: term.id,
                    })
                    .onConflictDoNothing(),
                ),
              );
            }
          }
        });
      },
      async () => {
        // Update strategies if provided
        await db.transaction(async (tx) => {
          if (data.strategies !== undefined) {
            // Remove existing strategies
            await tx
              .delete(organizationsStrategies)
              .where(
                eq(organizationsStrategies.organizationId, organizationId),
              );

            if (data.strategies.length > 0) {
              await Promise.all(
                data.strategies.map((strategy) =>
                  tx
                    .insert(organizationsStrategies)
                    .values({
                      organizationId: orgToUpdate.id,
                      taxonomyTermId: strategy.id,
                    })
                    .onConflictDoNothing(),
                ),
              );
            }
          }
        });
      },
      async () => {
        // Update communities served if provided
        await db.transaction(async (tx) => {
          if (data.communitiesServed !== undefined) {
            // Note: This updates the same table as focusAreas, so we need to be careful
            // For now, we'll assume communities served are handled separately from focus areas
            // If they share the same table, you might need to handle this differently
            if (data.communitiesServed.length > 0) {
              await Promise.all(
                data.communitiesServed.map((term) =>
                  tx
                    .insert(organizationsTerms)
                    .values({
                      organizationId: orgToUpdate.id,
                      taxonomyTermId: term.id,
                    })
                    .onConflictDoNothing(),
                ),
              );
            }
          }
        });
      },
    ],
    async (update: () => Promise<void>) => await update(),
    { concurrency: 3 },
  );

  // Fetch the updated organization and profile separately to ensure proper typing
  const [updatedOrg, updatedProfile] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    }),
    db.query.profiles.findFirst({
      where: eq(profiles.id, existingOrg.profileId),
      with: {
        headerImage: true,
        avatarImage: true,
      },
    }),
  ]);

  if (!updatedOrg || !updatedProfile) {
    throw new NotFoundError('Organization not found after update');
  }

  // @ts-ignore
  return { ...updatedOrg, profile: updatedProfile };
};
