import { createClient } from '@op/api/serverClient';
import { cache } from 'react';

// Module-scoped cache() lets generateMetadata + the page render the same slug
// without re-hitting the DB. cache() is per-request, so the duplicate fetch
// collapses into one promise within a single SSR render.
export const fetchProfileBySlug = cache(async (slug: string) => {
  const client = await createClient();
  return client.profile.getBySlug({ slug });
});

export const fetchOrganizationBySlug = cache(async (slug: string) => {
  const client = await createClient();
  return client.organization.getBySlug({ slug });
});
