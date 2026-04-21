import { zodUrl } from '@op/common/validation';
import { z } from 'zod';

/**
 * Shared validation schema for user profile updates
 */
export const updateUserProfileDataSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    bio: z.string().trim().max(255),
    title: z.string().trim().min(1).max(255),
    pronouns: z.string().trim().max(255).optional(),
    // underscore, numbers, lowercase letters
    username: z
      .string()
      .trim()
      .min(4)
      .max(255)
      .toLowerCase()
      .regex(/^[a-z0-9_]+$/),
    email: z
      .email({
        error: 'Invalid email',
      })
      .max(255, {
        error: 'Must be at most 255 characters',
      }),
    website: zodUrl({
      error: 'Enter a valid website address',
    }),
    focusAreas: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
      }),
    ),
  })
  .partial();
