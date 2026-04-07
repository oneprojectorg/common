import { randomUUID } from 'node:crypto';
import slugify from 'slugify';

/**
 * Mock implementation that returns a name-based slug with a UUID suffix.
 * This avoids race conditions in concurrent tests where multiple tests
 * might try to create profiles with the same slug (e.g., "my-proposal-2"),
 * while still preserving the name so slug-sync behavior can be tested.
 */
export const generateUniqueProfileSlug = async ({
  name,
}: {
  name: string;
  db?: unknown;
}): Promise<string> => {
  const base = slugify(name, { lower: true, strict: true, trim: true });
  return `${base}-${randomUUID().substring(0, 8)}`;
};
