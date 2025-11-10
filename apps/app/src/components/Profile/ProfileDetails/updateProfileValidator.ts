import { zodUrl } from '@/utils';
import { z } from 'zod';

export const validator = z.object({
  fullName: z
    .string({
      error: 'Enter your full name',
    })
    .trim()
    .min(1, {
      error: 'Enter your full name',
    })
    .max(200, {
      error: 'Must be at most 200 characters',
    }),
  title: z
    .string({
      error: 'Enter your professional title',
    })
    .trim()
    .min(1, {
      error: 'Enter your professional title',
    })
    .max(200, {
      error: 'Must be at most 200 characters',
    }),
  email: z
    .email()
    .trim()
    .refine((val) => val === '' || z.email().safeParse(val).success, {
      error: 'Invalid email',
    })
    .refine((val) => val.length <= 255, {
      error: 'Must be at most 255 characters',
    }),
  website: zodUrl({
    error: 'Enter a valid website address',
  }),
  focusAreas: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
      }),
    )
    .optional(),
});

export type FormFields = z.infer<typeof validator>;

export const acceptedImageTypes = [
  'image/gif',
  'image/png',
  'image/jpeg',
  'image/webp',
];
