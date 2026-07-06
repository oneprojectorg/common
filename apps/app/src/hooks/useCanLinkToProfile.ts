'use client';

import { useMaybeUser } from '@/utils/UserProvider';

/**
 * Whether the current viewer may link out to a profile page.
 *
 * Profile pages (`/profile/[slug]`, `/org/[slug]`) live inside the walled
 * garden, so a public or non-network-member viewer who follows such a link
 * only hits a login/forbidden wall. On surfaces that public visitors can reach
 * (e.g. public decision views), render the name/avatar as plain text instead
 * of a link when this returns `false`.
 *
 * Uses the non-throwing `useMaybeUser` so shared components (e.g. avatars) stay
 * safe when rendered outside a `UserProvider`, such as the onboarding tree.
 * Returns `false` for public (no-session) visitors and provider-less trees,
 * since `user` is absent in both cases.
 */
export const useCanLinkToProfile = (): boolean => {
  return Boolean(useMaybeUser()?.isNetworkMember);
};
