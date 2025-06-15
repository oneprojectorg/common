import { organizationUsers, organizations } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { linksEncoder } from './links';
import { profileEncoder } from './profiles';
import { projectEncoder } from './projects';
import { taxonomyTermsEncoder } from './taxonomyTerms';

export const organizationsEncoder = createSelectSchema(organizations)
  .pick({
    id: true,

    isOfferingFunds: true,
    isReceivingFunds: true,
    networkOrganization: true,
    orgType: true,
  })
  .merge(profileEncoder)
  .extend({
    projects: z.array(projectEncoder).optional(),
    links: z.array(linksEncoder).optional().default([]),
    whereWeWork: z.array(z.any()).optional().default([]),
    receivingFundsTerms: z.array(taxonomyTermsEncoder).optional().default([]),
    strategies: z.array(taxonomyTermsEncoder).optional().default([]),
  });

export const organizationsCreateInputEncoder = createSelectSchema(organizations)
  .pick({
    // Geography
    isVerified: true,

    isOfferingFunds: true,
    isReceivingFunds: true,

    // Organization Type
    orgType: true,
  })
  .extend({
    name: z.string(),
    slug: z.string(),
    bio: z.string(),

    // Mission
    mission: z.string(),
    // Year Founded
    yearFounded: z.string(),
    // Email
    email: z.string(),
    phone: z.string(),
    website: z.string(),
    // Address
    address: z.string(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
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

export type Organization = z.infer<typeof organizationsEncoder>;

export const orgUserEncoder = createSelectSchema(organizationUsers);
