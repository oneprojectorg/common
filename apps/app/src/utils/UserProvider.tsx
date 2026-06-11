'use client';

import { RouterOutput, trpc } from '@op/api/client';
import type { Permission } from 'access-zones';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import React, { Suspense, createContext, useContext } from 'react';

const AccessZones = ['decisions', 'profile', 'admin'] as const;

export type PermissionAction = keyof Permission;

const EMPTY_PERMISSION: Permission = {
  admin: false,
  create: false,
  read: false,
  update: false,
  delete: false,
};

export const isPermissionAction = (key: string): key is PermissionAction =>
  Object.prototype.hasOwnProperty.call(EMPTY_PERMISSION, key);

type CommonZonePermissions = Record<(typeof AccessZones)[number], Permission>;
const defaultPermissions = AccessZones.reduce<CommonZonePermissions>(
  (accum, key) => ({
    ...accum,
    [key]: { ...EMPTY_PERMISSION },
  }),
  {} as CommonZonePermissions,
);

// Type for the user data returned by getMyAccount
// You can refine this type by importing the correct type from your trpc/encoders if available
// import type { User } from '@op/api/encoders';

export type OrganizationUser = NonNullable<
  RouterOutput['account']['getMyAccount']
>;

interface UserContextValue {
  // Absent for public (no-session) visitors.
  user?: OrganizationUser;
  getPermissionsForProfile: (profileId: string) => CommonZonePermissions;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export const UserProviderSuspense = ({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: OrganizationUser | null;
}) => {
  const router = useRouter();
  // Use initialUser as initialData to avoid redundant client-side fetch.
  // staleTime prevents immediate background revalidation — the server already
  // fetched fresh data for this layout render, so there's no need to re-fetch
  // on mount. This also avoids a race condition where the client-side refetch
  // fires before middleware cookie refresh is complete during navigation.
  const [account] = trpc.account.getMyAccount.useSuspenseQuery(undefined, {
    initialData: initialUser,
    staleTime: 30 * 1000,
  });

  // Map the API's `null` (JSON has no undefined) to match `user?:` props.
  // Fall back to the server-rendered user: sign-outs always arrive via a
  // full-page navigation (fresh tree, null initialUser), so inside a mounted
  // tree a null refetch is a transient cookie/token race, not a sign-out.
  const user = account ?? initialUser ?? undefined;

  if (user && !user.onboardedAt) {
    router.push('/start');
  }

  if (user) {
    // We are only identifying One Project users by email.
    if (user.email?.match(/.+@oneproject\.org$|.+@peoplepowered\.org$/)) {
      posthog.identify(user.authUserId, { email: user.email, name: user.name });
    } else {
      // others are given anonymous IDs
      posthog.identify(user.authUserId);
    }
  }

  // Utility function to get permissions for a specific profile
  const getPermissionsForProfile = (
    profileId: string,
  ): CommonZonePermissions => {
    if (!user) {
      return defaultPermissions;
    }

    // First check profileUsers for a direct profile match
    const matchingProfileUser = user.profileUsers?.find(
      (profileUser) => profileUser.profileId === profileId,
    );

    if (matchingProfileUser?.permissions) {
      return { ...defaultPermissions, ...matchingProfileUser.permissions };
    }

    // Fall back to organizationUsers by matching the org's profile
    const matchingOrgUser = user.organizationUsers?.find(
      (orgUser) => orgUser.organization?.profile?.id === profileId,
    );

    return { ...defaultPermissions, ...(matchingOrgUser?.permissions || {}) };
  };

  const contextValue = {
    user,
    getPermissionsForProfile,
  };

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  );
};

export const UserProvider = ({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: OrganizationUser | null;
}) => {
  return (
    <Suspense fallback={null}>
      <UserProviderSuspense initialUser={initialUser}>
        {children}
      </UserProviderSuspense>
    </Suspense>
  );
};

/**
 * `user` is undefined for public (no-session) visitors. An anonymous sign-in
 * is NOT absent: it has a real account, just with no email or profiles.
 *
 * Use this on public-capable surfaces (decision views, profile pages) and
 * branch on `user` explicitly. For components that only render in auth-gated
 * trees, use `useRequiredUser` instead.
 */
export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return ctx;
}

/**
 * For components that only render in auth-gated trees (the middleware or a
 * server layout has already redirected signed-out visitors). Throwing here
 * means an auth-only component leaked onto a public surface — a bug, not a
 * user-facing state.
 */
export function useRequiredUser() {
  const ctx = useUser();
  const { user } = ctx;

  if (!user) {
    throw new Error(
      'useRequiredUser: no session. This component must only render in auth-gated trees.',
    );
  }

  return { ...ctx, user };
}
