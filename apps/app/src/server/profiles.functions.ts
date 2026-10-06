import { handleServerError } from '@/utils/handleServerError';
import { EntityType } from '@op/api/encoders';
import { createClient } from '@op/api/serverClient';
import { PAGE_LIMIT } from '@op/common/client';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const slugSchema = z.object({ slug: z.string() });

/**
 * A profile page's data. The org lookup throws NotFoundError for user-profile
 * slugs; it is swallowed to null and the page gates on `profile.type` —
 * `profile.getBySlug` is the source of truth for whether the slug is an org.
 */
export const getProfilePageData = createServerFn({ method: 'GET' })
  .validator(slugSchema)
  .handler(async ({ data }) => {
    const client = await createClient();

    try {
      const [profile, organization] = await Promise.all([
        client.profile.getBySlug({ slug: data.slug }),
        client.organization.getBySlug({ slug: data.slug }).catch(() => null),
      ]);

      return { profile, organization };
    } catch (error) {
      // A missing/forbidden profile becomes a 404/403; anything else is a
      // genuine failure and should surface as a 500 rather than a misleading
      // 404.
      handleServerError(error);
    }
  });

/** A profile's name for a page title, or null when it can't be read. */
export const getProfileName = createServerFn({ method: 'GET' })
  .validator(slugSchema)
  .handler(async ({ data }) => {
    try {
      const client = await createClient();
      const profile = await client.profile.getBySlug({ slug: data.slug });

      return profile.name ?? null;
    } catch {
      return null;
    }
  });

/**
 * The first page of a profile directory, or null when it can't be loaded —
 * the page then renders an empty list the client can still page through.
 */
export const listDirectoryProfiles = createServerFn({ method: 'GET' })
  .validator(z.object({ directory: z.enum(['organizations', 'people']) }))
  .handler(async ({ data }) => {
    try {
      const client = await createClient();

      return await client.profile.list(
        data.directory === 'organizations'
          ? { limit: PAGE_LIMIT.lg, types: [EntityType.ORG] }
          : { limit: 5, types: [EntityType.INDIVIDUAL] },
      );
    } catch {
      return null;
    }
  });
