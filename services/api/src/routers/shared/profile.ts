import { CommonError } from '@op/common';
import { zodUrl } from '@op/common/validation';
import { logger } from '@op/logging';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

/**
 * Handles errors from user profile update operations
 * Converts common errors into appropriate TRPC or Zod errors
 */
export function handleUpdateUserProfileError(error: unknown): never {
  logger.error('Error updating user profile', { error });

  // Re-throw UnauthorizedError as-is (will be caught by error handler)
  if (error instanceof CommonError) {
    throw error;
  }

  // If it's already a TRPC error, re-throw it
  if (error instanceof TRPCError) {
    throw error;
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
