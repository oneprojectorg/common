import { cache } from '@op/cache';
import { db, eq } from '@op/db/client';
import { allowList } from '@op/db/schema';

import { AllowListUser, allowListMetadataSchema } from './validators';

// Nothing invalidates an allow-list entry when an invite is revoked, so this
// TTL is the only bound on how long a revoked invite keeps working.
const ALLOW_LIST_CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Cache key for the `allowList` cache. Every read goes through
 * {@link getCachedAllowListUser}, so this is the single place the key shape is
 * defined — keying by anything coarser than the full email (an email domain,
 * say) would serve the first caller's invitation row to every later caller
 * that shares that prefix, and callers such as `joinOrganization` authorize
 * against the row they read back.
 */
export const allowListCacheKey = ({ email }: { email: string }): [string] => [
  email.toLowerCase(),
];

/**
 * Fetch an allow list entry by email.
 */
export const getAllowListUser = async ({
  email,
}: {
  email?: string;
}): Promise<AllowListUser | undefined> => {
  if (!email) {
    return;
  }

  const [allowedResult] = await db
    .select({
      email: allowList.email,
      organizationId: allowList.organizationId,
      metadata: allowList.metadata,
    })
    .from(allowList)
    .where(eq(allowList.email, email.toLowerCase()))
    .limit(1);

  if (!allowedResult) {
    return;
  }

  // Extract role from allowListUser metadata if present
  const metadata = allowListMetadataSchema.safeParse(
    allowedResult.metadata ?? {},
  );

  return {
    ...allowedResult,
    metadata: metadata.success ? metadata.data : null,
  };
};

/**
 * Cached {@link getAllowListUser}. The only supported way to read the
 * `allowList` cache: it owns the key, the TTL and the fetch together so the
 * call sites cannot drift apart on any of them.
 */
export const getCachedAllowListUser = ({
  email,
}: {
  email: string;
}): Promise<AllowListUser | undefined> =>
  cache<AllowListUser | undefined>({
    type: 'allowList',
    params: allowListCacheKey({ email }),
    fetch: () => getAllowListUser({ email }),
    options: {
      ttl: ALLOW_LIST_CACHE_TTL_MS,
    },
  });
