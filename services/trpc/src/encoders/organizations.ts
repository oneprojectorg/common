import {
  objectsInStorage,
  organizationUsers,
  organizations,
  organizationsWhereWeWork,
} from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { linksEncoder } from './links';
import { projectEncoder } from './projects';
import { taxonomyTermsEncoder } from './taxonomyTerms';

export const storageItemEncoder = createSelectSchema(objectsInStorage).pick({
  id: true,
  name: true,
  // TODO: add metadata but make sure TRPC can resolve the type properly
});

export const organizationsEncoder = createSelectSchema(organizations)
  .pick({
    id: true,
    slug: true,
    name: true,
    city: true,
    state: true,
    description: true,
    mission: true,
    email: true,
    website: true,
    isOfferingFunds: true,
    isReceivingFunds: true,
    orgType: true,
  })
  .extend({
    projects: z.array(projectEncoder).optional(),
    links: z.array(linksEncoder).default([]),
    whereWeWork: z.array(taxonomyTermsEncoder).default([]),
    strategies: z.array(taxonomyTermsEncoder).default([]),
    headerImage: storageItemEncoder.nullish(),
    avatarImage: storageItemEncoder.nullish(),
  });

export const organizationsCreateInputEncoder = createSelectSchema(organizations)
  .pick({
    name: true,
    slug: true,
    description: true,

    // Mission
    mission: true,
    // Year Founded
    yearFounded: true,
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

    // Organization Type
    orgType: true,
  })
  .partial();

export type OrganizationCreateInput = z.infer<
  typeof organizationsCreateInputEncoder
>;

export type Organization = z.infer<typeof organizationsEncoder>;

export const orgUserEncoder = createSelectSchema(organizationUsers);
