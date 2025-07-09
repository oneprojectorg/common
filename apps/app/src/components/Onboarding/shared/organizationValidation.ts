import { zodUrl } from '@/utils';
import { z } from 'zod';

export const multiSelectOptionValidator = z.object({
  id: z.string(),
  label: z.string().max(200),
  isNewValue: z.boolean().default(false).optional(),
  data: z.record(z.any()).default({}),
});

export const organizationFormValidator = z.object({
  name: z
    .string({ message: 'Enter a name for your organization' })
    .min(1, { message: 'Enter a name for your organization' })
    .max(100, { message: 'Must be at most 100 characters' }),
  website: zodUrl({
    message: 'Enter a valid website address',
    isRequired: true,
  }),
  email: z
    .string({ message: 'Enter an email' })
    .email({ message: 'Invalid email' })
    .max(200, { message: 'Must be at most 200 characters' }),
  orgType: z
    .string({ message: 'Select an organization type' })
    .max(200, { message: 'Must be at most 200 characters' })
    .min(1, { message: 'Select an organization type' }),
  bio: z
    .string({ message: 'Enter an organization bio' })
    .max(150, { message: 'Must be at most 150 characters' })
    .min(1, { message: 'Enter an organization bio' }),
  mission: z
    .string()
    .max(1500, { message: 'Must be at most 1500 characters' })
    .optional(),
  whereWeWork: z.array(multiSelectOptionValidator).optional(),
  focusAreas: z.array(multiSelectOptionValidator).optional(),
  communitiesServed: z.array(multiSelectOptionValidator).optional(),
  strategies: z.array(multiSelectOptionValidator).optional(),
  networkOrganization: z.boolean().default(false),
  orgAvatarImageId: z.string().optional(),
  orgBannerImageId: z.string().optional(),
});

export type OrganizationFormData = z.infer<typeof organizationFormValidator>;
