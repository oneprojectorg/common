import { organizationUsers, organizations, profiles } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { linksEncoder } from './links';
import { locationEncoder } from './locations';
import { baseProfileEncoder } from './profiles';
import { projectEncoder } from './projects';
import { entityTermsEncoder } from './shared';
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
    links: z.array(linksEncoder).prefault([]),
    whereWeWork: z.array(locationEncoder).prefault([]),
    receivingFundsTerms: z.array(taxonomyTermsEncoder).prefault([]),
    strategies: z.array(taxonomyTermsEncoder).prefault([]),
    headerImage: storageItemEncoder.nullish(),
    avatarImage: storageItemEncoder.nullish(),
    acceptingApplications: z.boolean().prefault(false).optional(),
  });

export const organizationsWithProfileEncoder = organizationsEncoder.extend({
  profile: baseProfileEncoder,
});

const organizationFields = createSelectSchema(organizations).pick({
  isOfferingFunds: true,
  isReceivingFunds: true,
  acceptingApplications: true,
  orgType: true,
});

const profileFields = createSelectSchema(profiles).pick({
  name: true,
  slug: true,
  bio: true,
  mission: true,
  email: true,
  phone: true,
  website: true,
  address: true,
  city: true,
  state: true,
  postalCode: true,
});

export const organizationsCreateInputEncoder = organizationFields
  .extend(profileFields.shape)
  .partial();

export const organizationsTermsEncoder = entityTermsEncoder;

export type OrganizationCreateInput = z.infer<
  typeof organizationsCreateInputEncoder
>;

export type Organization = z.infer<typeof organizationsWithProfileEncoder>;

export const orgUserEncoder = createSelectSchema(organizationUsers);
