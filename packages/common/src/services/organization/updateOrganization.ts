import { type DbClient, db as defaultDb, eq, sql } from '@op/db/client';
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
import { permission } from 'access-zones';

import { CommonError, NotFoundError } from '../../utils';
import { assertOrgAccess, assertOrganization } from '../assert';
import {
  type FundingLinksInput,
  type UpdateOrganizationInput,
  UpdateOrganizationInputParser,
} from './validators';

export const updateOrganization = async ({
  id,
  data,
  user,
  db = defaultDb,
}: {
  id: string;
  data: UpdateOrganizationInput &
    FundingLinksInput & {
      orgAvatarImageId?: string;
      orgBannerImageId?: string;
    };
  user: User;
  db?: DbClient;
}) => {
  const organizationId = id;
  if (!organizationId) {
    throw new CommonError('Organization ID is required');
  }

  await assertOrgAccess({
    user,
    organizationId,
    permissions: { profile: permission.UPDATE },
  });

  const { ...updateData } = data;

  // Check if user has permission to update this organization
  const existingOrg = await assertOrganization(organizationId, undefined, db);

  const orgInputs = UpdateOrganizationInputParser.parse(updateData);

  // One transaction for the whole update. These writes describe a single
  // organization edit, so a failure partway through must not leave the row
  // updated with stale strategies, locations, or funding links attached.
  //
  // The steps run in order rather than concurrently: a transaction is pinned to
  // one connection, so issuing them together buys no parallelism, and a
  // rejection mid-flight would race the rollback against its siblings.
  await db.transaction(async (tx) => {
    const [orgToUpdate] = await tx
      .update(organizations)
      .set(orgInputs)
      .where(eq(organizations.id, organizationId))
      .returning();

    if (!orgToUpdate) {
      throw new NotFoundError('Organization', organizationId);
    }

    // Update profile with relevant fields
    const profileFields = Object.fromEntries(
      Object.entries(data).filter(
        ([key, value]) => value !== undefined && key !== 'id',
      ),
    );

    // Only update profile if there are fields to update
    if (Object.keys(profileFields).length > 0) {
      await tx
        .update(profiles)
        .set({
          ...profileFields,
          headerImageId: data.orgBannerImageId,
          avatarImageId: data.orgAvatarImageId,
        })
        .where(eq(profiles.id, orgToUpdate.profileId));
    }

    // Update funding links if provided
    if (
      data.receivingFundsLink !== undefined ||
      data.offeringFundsLink !== undefined
    ) {
      // Remove existing funding links
      await tx.delete(links).where(eq(links.organizationId, organizationId));

      // Add new funding links
      if (data.receivingFundsLink) {
        await tx.insert(links).values({
          organizationId: orgToUpdate.id,
          href: data.receivingFundsLink,
          description: data.receivingFundsDescription,
          type: 'receiving',
        });
      }

      if (data.offeringFundsLink) {
        await tx.insert(links).values({
          organizationId: orgToUpdate.id,
          href: data.offeringFundsLink,
          description: data.offeringFundsDescription,
          type: 'offering',
        });
      }
    }

    // Update where we work locations if provided
    if (data.whereWeWork !== undefined) {
      // Remove existing where we work entries
      await tx
        .delete(organizationsWhereWeWork)
        .where(eq(organizationsWhereWeWork.organizationId, organizationId));

      for (const whereWeWork of data.whereWeWork) {
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
      }
    }

    // Update focus areas if provided. focusAreas, communitiesServed, and
    // receivingFundsTerms all write organizationsTerms; the delete belongs to
    // focusAreas alone and must run before the other two insert, which is why
    // this block leads and they follow in order.
    if (data.focusAreas !== undefined) {
      // Remove existing focus areas
      await tx
        .delete(organizationsTerms)
        .where(eq(organizationsTerms.organizationId, organizationId));

      for (const term of data.focusAreas) {
        await tx
          .insert(organizationsTerms)
          .values({
            organizationId: orgToUpdate.id,
            taxonomyTermId: term.id,
          })
          .onConflictDoNothing();
      }
    }

    // Update strategies if provided
    if (data.strategies !== undefined) {
      // Remove existing strategies
      await tx
        .delete(organizationsStrategies)
        .where(eq(organizationsStrategies.organizationId, organizationId));

      for (const strategy of data.strategies) {
        await tx
          .insert(organizationsStrategies)
          .values({
            organizationId: orgToUpdate.id,
            taxonomyTermId: strategy.id,
          })
          .onConflictDoNothing();
      }
    }

    // Update communities served if provided
    if (data.communitiesServed !== undefined) {
      for (const term of data.communitiesServed) {
        await tx
          .insert(organizationsTerms)
          .values({
            organizationId: orgToUpdate.id,
            taxonomyTermId: term.id,
          })
          .onConflictDoNothing();
      }
    }

    // Update receiving funds terms if provided
    if (data.receivingFundsTerms !== undefined) {
      for (const term of data.receivingFundsTerms) {
        await tx
          .insert(organizationsTerms)
          .values({
            organizationId: orgToUpdate.id,
            taxonomyTermId: term.id,
          })
          .onConflictDoNothing();
      }
    }
  });

  // Fetch the updated organization and profile separately to ensure proper typing
  const [updatedOrg, updatedProfile] = await Promise.all([
    db.query.organizations.findFirst({
      where: { id: organizationId },
    }),
    db.query.profiles.findFirst({
      where: { id: existingOrg.profileId },
      with: {
        headerImage: true,
        avatarImage: true,
      },
    }),
  ]);

  if (!updatedOrg || !updatedProfile) {
    throw new NotFoundError('Organization', organizationId);
  }

  // @ts-ignore
  return { ...updatedOrg, profile: updatedProfile };
};
