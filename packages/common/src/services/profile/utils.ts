import { DatabaseType, TransactionType, db as database } from '@op/db/client';
import { profiles } from '@op/db/schema';
import { randomUUID } from 'crypto';
import { inArray } from 'drizzle-orm';
import slugify from 'slugify';

/**
 * Generates a unique profile slug based on a profile name.
 */
export const generateUniqueProfileSlug = async ({
  name,
  db,
}: {
  name: string;
  db?: DatabaseType | TransactionType;
}): Promise<string> => {
  const MAX_ATTEMPTS = 10;
  const MAX_SLUG_LENGTH = 256;

  if (!db) {
    db = database;
  }

  // Generate base slug from name
  let baseSlug = slugify(name, {
    lower: true,
    strict: true,
    trim: true,
  });

  // Handle edge cases where slugify returns empty string
  if (!baseSlug || baseSlug.length === 0) {
    baseSlug = 'profile';
  }

  // Truncate if too long, leaving room for potential suffix
  if (baseSlug.length > MAX_SLUG_LENGTH - 20) {
    baseSlug = baseSlug.substring(0, MAX_SLUG_LENGTH - 20);
  }

  // Build list of all potential slugs to check
  const candidateSlugs = [baseSlug];
  for (let i = 2; i <= MAX_ATTEMPTS + 1; i++) {
    candidateSlugs.push(`${baseSlug}-${i}`);
  }

  // Query for all existing slugs in a single database call
  const existingSlugs = await db
    .select({ slug: profiles.slug })
    .from(profiles)
    .where(inArray(profiles.slug, candidateSlugs));

  // Convert to Set for O(1) lookup
  const existingSlugSet = new Set(existingSlugs.map((row) => row.slug));

  // Find the first available slug
  for (const candidate of candidateSlugs) {
    if (!existingSlugSet.has(candidate)) {
      return candidate;
    }
  }

  // After MAX_ATTEMPTS, try UUID-based slugs
  // Generate multiple UUID candidates and check them all at once
  const UUID_ATTEMPTS = 5;
  const uuidCandidates: string[] = [];

  for (let i = 0; i < UUID_ATTEMPTS; i++) {
    const shortUuid = randomUUID().substring(0, 8);
    const uuidSlug = `${baseSlug}-${shortUuid}`;

    // Ensure it fits within length constraint
    if (uuidSlug.length > MAX_SLUG_LENGTH) {
      uuidCandidates.push(
        `${baseSlug.substring(0, MAX_SLUG_LENGTH - 9)}-${shortUuid}`,
      );
    } else {
      uuidCandidates.push(uuidSlug);
    }
  }

  // Query for UUID-based candidates
  const existingUuidSlugs = await db
    .select({ slug: profiles.slug })
    .from(profiles)
    .where(inArray(profiles.slug, uuidCandidates));

  const existingUuidSlugSet = new Set(existingUuidSlugs.map((row) => row.slug));

  // Return the first available UUID-based slug
  for (const candidate of uuidCandidates) {
    if (!existingUuidSlugSet.has(candidate)) {
      return candidate;
    }
  }

  // Extremely unlikely: all UUID attempts are taken, generate one more as final fallback
  const finalUuid = randomUUID().substring(0, 8);
  const finalSlug = `${baseSlug}-${finalUuid}`;

  if (finalSlug.length > MAX_SLUG_LENGTH) {
    return `${baseSlug.substring(0, MAX_SLUG_LENGTH - 9)}-${finalUuid}`;
  }

  return finalSlug;
};
