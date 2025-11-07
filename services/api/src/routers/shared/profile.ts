import { zodUrl } from '@op/common/validation';
import { TRPCError } from '@trpc/server';
import { ZodError } from 'zod';
import { z } from 'zod';

/**
 * Handles errors from user profile update operations
 * Converts common errors into appropriate TRPC or Zod errors
 */
export function handleUpdateUserProfileError(error: unknown): never {
  console.error(error);

  // If it's already a TRPC error, re-throw it
  if (error instanceof TRPCError) {
    throw error;
  }

  if (error instanceof Error) {
    // Handle duplicate username error
    if (error.message.includes('duplicate')) {
      throw new ZodError([
        {
          code: 'custom',
          message: 'Username already in use',
          path: ['username'],
        },
      ]);
    }

    // Handle authorization errors
    if (
      error.message.includes('Platform admin') ||
      error.message.includes('Unauthorized')
    ) {
      throw new TRPCError({
        message: 'Platform admin access required',
        code: 'UNAUTHORIZED',
      });
    }
  }

  // Default error response
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Failed to update profile',
  });
}

/**
 * Shared validation schema for user profile updates
 */
export const updateUserProfileDataSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    bio: z.string().trim().max(255),
    title: z.string().trim().min(1).max(255),
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
