'use client';

import { ClientOnly } from '@/utils/ClientOnly';
import { useUser } from '@/utils/UserProvider';
import { Skeleton } from '@op/sense/Skeleton';
import { Suspense } from 'react';

import ErrorBoundary from '../ErrorBoundary';
import { LocaleChooser } from '../LocaleChooser';
import { CreateMenu } from './CreateMenu';
import { UserAvatarMenu } from './UserAvatarMenu';

/**
 * Right-side header actions. Creating and the account menu are authed
 * features; signed-out visitors only get the locale chooser.
 */
export const HeaderActions = () => {
  const { user } = useUser();

  return (
    <ClientOnly>
      {user && <CreateMenu />}
      <LocaleChooser />
      {user && (
        <ErrorBoundary
          fallback={
            <div className="size-10 rounded-full border bg-white shadow" />
          }
        >
          <Suspense
            fallback={
              <Skeleton className="size-10 rounded-full border bg-white shadow" />
            }
          >
            <UserAvatarMenu />
          </Suspense>
        </ErrorBoundary>
      )}
    </ClientOnly>
  );
};
