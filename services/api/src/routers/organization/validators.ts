import { z } from 'zod';

import { locationEncoder } from '../../encoders/locations';

export const multiSelectOptionValidator = z.object({
  id: z.string(),
  label: z.string().max(200),
  isNewValue: z.boolean().default(false).optional(),
  data: z.any().optional(),
});

export const baseOrganizationSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Enter a name for your organization' })
    .max(200, { message: 'Must be at most 200 characters' }),
  website: z
    .string()
    .min(1, { message: 'enter a website' })
    .max(200, { message: 'Must be at most 200 characters' }),
  email: z
    .string()
    .email({ message: 'Invalid email' })
    .max(200, { message: 'Must be at most 200 characters' }),
  orgType: z.string().max(200, { message: 'Must be at most 20 characters' }),
  bio: z.string().max(1500, { message: 'Must be at most 1500 characters' }),
  mission: z.string().max(1500, { message: 'Must be at most 1500 characters' }),
  whereWeWork: z.array(
    multiSelectOptionValidator.extend({
      data: locationEncoder,
    }),
  ),
  focusAreas: z.array(multiSelectOptionValidator),
  communitiesServed: z.array(multiSelectOptionValidator),
  strategies: z.array(multiSelectOptionValidator),
  networkOrganization: z.boolean(),
  isReceivingFunds: z.boolean(),
  isOfferingFunds: z.boolean(),
  acceptingApplications: z.boolean(),
  receivingFundsDescription: z.string(),
  receivingFundsLink: z.string(),
  offeringFundsDescription: z.string(),
  offeringFundsLink: z.string(),
  orgAvatarImageId: z.string(),
  orgBannerImageId: z.string(),
});

// Create organization schema - some fields required, others optional
export const createOrganizationInputSchema = baseOrganizationSchema.extend({
  name: z
    .string()
    .min(1, { message: 'Enter a name for your organization' })
    .max(200, { message: 'Must be at most 200 characters' })
    .optional(),
  website: z
    .string()
    .min(1, { message: 'enter a ' })
    .max(200, { message: 'Must be at most 200 characters' }),
  email: z
    .string()
    .email({ message: 'Invalid email' })
    .max(200, { message: 'Must be at most 200 characters' })
    .optional(),
  orgType: z.string().max(200, { message: 'Must be at most 20 characters' }),
  bio: z.string().max(1500, { message: 'Must be at most 1500 characters' }),
  mission: z
    .string()
    .max(1500, { message: 'Must be at most 1500 characters' })
    .optional(),
  whereWeWork: z
    .array(
      multiSelectOptionValidator.extend({
        data: locationEncoder,
      }),
    )
    .optional(),
  focusAreas: z.array(multiSelectOptionValidator).optional(),
  receivingFundsTerms: z.array(multiSelectOptionValidator).optional(),
  communitiesServed: z.array(multiSelectOptionValidator).optional(),
  strategies: z.array(multiSelectOptionValidator).optional(),
  networkOrganization: z.boolean().default(false),
  isReceivingFunds: z.boolean().default(false).optional(),
  isOfferingFunds: z.boolean().default(false).optional(),
  acceptingApplications: z.boolean().default(false).optional(),
  receivingFundsDescription: z.string().optional(),
  receivingFundsLink: z.string().optional(),
  offeringFundsDescription: z.string().optional(),
  offeringFundsLink: z.string().optional(),
  orgAvatarImageId: z.string().optional(),
  orgBannerImageId: z.string().optional(),
});

// Update organization schema - all fields optional except id
export const updateOrganizationInputSchema = baseOrganizationSchema
  .partial()
  .extend({
    id: z.string(),
  });
