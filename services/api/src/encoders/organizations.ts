import { organizationUsers, organizations, profiles } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { linksEncoder } from './links';
import { locationEncoder } from './locations';
import { baseProfileEncoder } from './profiles';
import { projectEncoder } from './projects';
import { storageItemEncoder } from './storageItem';
import { taxonomyTermsEncoder } from './taxonomyTerms';

export const organizationsEncoder = createSelectSchema(organizations)
  .pick({
    id: true,
    isOfferingFunds: true,
    isReceivingFunds: true,
    acceptingApplications: true,
    networkOrganization: true,
    orgType: true,
    domain: true,
  })
  .extend({
    profile: baseProfileEncoder.optional(),
    projects: z.array(projectEncoder).optional(),
    links: z.array(linksEncoder).optional().default([]),
    whereWeWork: z.array(locationEncoder).optional().default([]),
    receivingFundsTerms: z.array(taxonomyTermsEncoder).optional().default([]),
    strategies: z.array(taxonomyTermsEncoder).optional().default([]),
    headerImage: storageItemEncoder.nullish(),
    avatarImage: storageItemEncoder.nullish(),
    acceptingApplications: z.boolean().default(false).optional(),
  });

export const organizationsWithProfileEncoder = organizationsEncoder.extend({
  profile: baseProfileEncoder,
});

export const organizationsCreateInputEncoder = createSelectSchema(organizations)
  .merge(createSelectSchema(profiles))
  .pick({
    name: true,
    slug: true,
    bio: true,

    // Mission
    mission: true,
    // Email
    email: true,
    phone: true,
    website: true,
    // Address
    address: true,
    city: true,
    state: true,
    postalCode: true,
    // Geography
    isVerified: true,

    isOfferingFunds: true,
    isReceivingFunds: true,
    acceptingApplications: true,

    // Organization Type
    orgType: true,
  })
  .partial();

export const organizationsTermsEncoder = z.record(
  z.string(),
  z.array(
    z.object({
      termUri: z.string(),
      taxonomyUri: z.string(),
      id: z.string(),
      label: z.string(),
      facet: z.string().nullish(),
    }),
  ),
);

export type OrganizationCreateInput = z.infer<
  typeof organizationsCreateInputEncoder
>;

export type Organization = z.infer<typeof organizationsWithProfileEncoder>;

export const orgUserEncoder = createSelectSchema(organizationUsers);
