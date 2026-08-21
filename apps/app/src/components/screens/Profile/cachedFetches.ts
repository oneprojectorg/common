import { EntityType } from '@op/api/encoders';
import { createClient } from '@op/api/serverClient';
import { cache } from 'react';

// Module-scoped cache() lets generateMetadata + the page render the same slug
// without re-hitting the DB. cache() is per-request, so the duplicate fetch
// collapses into one promise within a single SSR render.
export const fetchProfileBySlug = cache(async (slug: string) => {
  const client = await createClient();
  return client.profile.getBySlug({ slug });
});

const fetchOrganizationBySlug = cache(async (slug: string) => {
  const client = await createClient();
  return client.organization.getBySlug({ slug });
});

/**
 * Loads everything the profile screen renders for a slug.
 *
 * The organization lookup only resolves for org profiles — for an individual,
 * anonymous or proposal slug it throws, and the tRPC layer logs that throw as a
 * server error before the caller can swallow it. So the profile type has to be
 * resolved first and the organization fetched only when the slug is an org.
 *
 * A null `organization` therefore means "this slug is not an org", never "the
 * org lookup failed" — a genuinely missing organization row propagates.
 */
export const fetchProfileScreenData = async (slug: string) => {
  const profile = await fetchProfileBySlug(slug);
  const organization =
    profile.type === EntityType.ORG
      ? await fetchOrganizationBySlug(slug)
      : null;

  return { profile, organization };
};
