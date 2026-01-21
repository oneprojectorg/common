import { randomUUID } from 'node:crypto';

/**
 * Mock implementation that always returns a UUID-based slug.
 * This avoids race conditions in concurrent tests where multiple tests
 * might try to create profiles with the same slug (e.g., "my-proposal-2").
 */
export const generateUniqueProfileSlug = async (): Promise<string> => {
  return `test-slug-${randomUUID()}`;
};
