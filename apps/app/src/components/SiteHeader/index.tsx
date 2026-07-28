'use client';

import { ClientOnly } from '@/utils/ClientOnly';
import { useUser } from '@/utils/UserProvider';
import { Button } from '@op/sense/Button';
import { SidebarTrigger } from '@op/sense/Sidebar';
import { Skeleton } from '@op/sense/Skeleton';
import { Suspense, useState } from 'react';
import { LuAlignJustify, LuSearch } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { CommonLogo } from '../CommonLogo';
import ErrorBoundary from '../ErrorBoundary';
import { LocaleChooser } from '../LocaleChooser';
import { SearchInput } from '../SearchInput';
import { CreateMenu } from './CreateMenu';
import { UserAvatarMenu } from './UserAvatarMenu';

export { UserAvatarMenu };

/**
 * Account control for headers on public surfaces: signed-in, non-anonymous
 * users get the avatar menu; logged-out visitors and anonymous accounts get a
 * "Log in" button instead (they have no account menu to show).
 */
export const HeaderUserMenu = ({ className }: { className?: string }) => {
  const t = useTranslations();
  const { user } = useUser();

  if (user && !user.isAnonymous) {
    return <UserAvatarMenu className={className} />;
  }

  return (
    // Native nav: /login is outside the [locale] tree, so a RAC link 404s at /en/login.
    <Button
      size="sm"
      className={className}
      onClick={() =>
        window.location.assign(
          `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`,
        )
      }
    >
      {t('Log in')}
    </Button>
  );
};

/**
 * Right-side header actions. Creating and the account menu are authed
 * features; signed-out visitors only get the locale chooser.
 */
const HeaderActions = () => {
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

export const SiteHeader = () => {
  const t = useTranslations();
  const [isMobileSearchExpanded, setIsMobileSearchExpanded] = useState(false);

  return (
    <>
      <header className="gridCentered relative z-20 hidden h-auto w-full items-center justify-between border-b border-border bg-background px-6 py-2 sm:grid">
        <div className="flex items-center gap-3">
          <SidebarTrigger
            aria-label={t('Open menu')}
            className="size-11 rounded-lg"
          >
            <LuAlignJustify className="size-4" />
          </SidebarTrigger>
          <Link href="/" className="flex gap-1" aria-label={t('Home')}>
            <CommonLogo />
          </Link>
        </div>
        <span className="flex items-center justify-center">
          <ErrorBoundary fallback={<Skeleton className="h-11 w-96" />}>
            <SearchInput />
          </ErrorBoundary>
        </span>
        <div className="flex items-center gap-3">
          <HeaderActions />
        </div>
      </header>

      {/* Mobile */}
      <header className="relative z-20 flex h-auto w-full items-center justify-between border-b border-border bg-background px-4 py-2 sm:hidden">
        {!isMobileSearchExpanded && (
          <div className="flex items-center gap-3">
            <SidebarTrigger
              aria-label={t('Open menu')}
              className="size-8 rounded-lg"
            >
              <LuAlignJustify className="size-4" />
            </SidebarTrigger>
            <Link href="/" className="flex gap-1" aria-label={t('Home')}>
              <CommonLogo />
            </Link>
          </div>
        )}

        <div
          className={`flex ${isMobileSearchExpanded ? 'w-full items-center justify-between' : 'gap-3'}`}
        >
          {isMobileSearchExpanded ? (
            <>
              <div className="min-w-0 flex-1">
                <ErrorBoundary fallback={<Skeleton className="h-10 w-full" />}>
                  <SearchInput
                    onBlur={() => setIsMobileSearchExpanded(false)}
                  />
                </ErrorBoundary>
              </div>
              <Button
                variant="ghost"
                onClick={() => setIsMobileSearchExpanded(false)}
                className="ms-3 text-muted-foreground"
              >
                {t('Cancel')}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setIsMobileSearchExpanded(true)}
                aria-label={t('Search')}
              >
                <LuSearch className="size-4 text-muted-foreground" />
              </Button>

              <div className="flex items-center gap-3">
                <HeaderActions />
              </div>
            </>
          )}
        </div>
      </header>
    </>
  );
};
