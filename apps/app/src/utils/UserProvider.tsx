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

// `getMyAccount` resolves to `null` for public (no-session) and anonymous
// callers; `OrganizationUser` is the non-null shape for real accounts.
export type OrganizationUser = NonNullable<
  RouterOutput['account']['getMyAccount']
>;

interface UserContextValue {
  // `null` when the viewer is a public/anonymous visitor with no real account.
  user: OrganizationUser | null;
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
  const [user] = trpc.account.getMyAccount.useSuspenseQuery(undefined, {
    initialData: initialUser,
    staleTime: 30 * 1000,
  });

  // Public / anonymous visitors have no account — there's nothing to onboard
  // or identify, so render the public view as-is.
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
    // Public / anonymous visitors hold no permissions in any zone.
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
 * Returns the user context, allowing `user` to be `null` for public /
 * anonymous visitors. Use this on routes that are reachable without an account
 * (e.g. public decision pages); use {@link useUser} on authenticated-only
 * routes where a real account is guaranteed.
 */
export function useOptionalUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useOptionalUser must be used within a UserProvider');
  }
  return ctx;
}

/**
 * Returns the user context, guaranteeing a non-null `user`. Throws if rendered
 * for a public / anonymous visitor — those routes must use
 * {@link useOptionalUser} instead.
 */
export function useUser() {
  const ctx = useOptionalUser();
  if (!ctx.user) {
    throw new Error(
      'useUser requires an authenticated user; use useOptionalUser on public routes',
    );
  }
  return { ...ctx, user: ctx.user };
}
