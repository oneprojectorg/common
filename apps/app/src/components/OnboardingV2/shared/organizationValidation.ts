import { zodUrl } from '@op/common/validation';
import { z } from 'zod';

export const multiSelectOptionValidator = z.object({
  id: z.string(),
  label: z.string().max(200),
  isNewValue: z.boolean().prefault(false).optional(),
  data: z.record(z.string(), z.any()).prefault({}),
});

export const organizationFormValidator = z.object({
  name: z
    .string({
      error: 'Enter a name for your organization',
    })
    .min(1, {
      error: 'Enter a name for your organization',
    })
    .max(100, {
      error: 'Must be at most 100 characters',
    }),
  website: zodUrl({
    isRequired: true,
    error: 'Enter a valid website address',
  }),
  email: z
    .email({
      error: 'Invalid email',
    })
    .max(200, {
      error: 'Must be at most 200 characters',
    }),
  orgType: z
    .string({
      error: 'Select an organization type',
    })
    .max(200, {
      error: 'Must be at most 200 characters',
    })
    .min(1, {
      error: 'Select an organization type',
    }),
  bio: z
    .string({
      error: 'Enter an organization bio',
    })
    .max(150, {
      error: 'Must be at most 150 characters',
    })
    .min(1, {
      error: 'Enter an organization bio',
    }),
  mission: z
    .string()
    .max(1500, {
      error: 'Must be at most 1500 characters',
    })
    .optional(),
  whereWeWork: z.array(multiSelectOptionValidator).optional(),
  focusAreas: z.array(multiSelectOptionValidator).optional(),
  communitiesServed: z.array(multiSelectOptionValidator).optional(),
  strategies: z.array(multiSelectOptionValidator).optional(),
  networkOrganization: z.boolean().prefault(false),
  orgAvatarImageId: z.string().optional(),
  orgBannerImageId: z.string().optional(),
});

export type OrganizationFormData = z.infer<typeof organizationFormValidator>;
