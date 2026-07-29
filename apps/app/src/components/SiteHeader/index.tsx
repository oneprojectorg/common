'use client';

import { ClientOnly } from '@/utils/ClientOnly';
import { useUser } from '@/utils/UserProvider';
import { Button } from '@op/sense/Button';
import { SidebarTrigger } from '@op/sense/Sidebar';
import { Skeleton } from '@op/sense/Skeleton';
import { cn } from '@op/sense/lib/utils';
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

/**
 * One responsive header for desktop and mobile. Rendered once (not a
 * desktop/mobile pair), so shared bits — logo, menu trigger, actions — mount a
 * single time; that's what keeps CommonLogo's inlined gradient ids unique.
 *
 * Layout: `gridCentered` 3-column grid on md+ (logo | centered search |
 * actions); a flex row below md (logo ... [search icon + actions]). Below md
 * the search icon expands to a full-width input + Cancel over the whole bar.
 */
export const SiteHeader = () => {
  const t = useTranslations();
  const [isMobileSearchExpanded, setIsMobileSearchExpanded] = useState(false);

  return (
    <header className="relative z-20 flex h-auto w-full items-center justify-between gap-3 border-b border-border bg-background px-4 py-2 md:grid md:grid-cols-[1fr_auto_1fr] md:px-6">
      <div
        className={cn(
          'flex items-center gap-3',
          isMobileSearchExpanded && 'hidden',
        )}
      >
        <SidebarTrigger
          aria-label={t('Open menu')}
          className="size-8 rounded-lg md:size-11"
        >
          <LuAlignJustify className="size-4" />
        </SidebarTrigger>
        <Link href="/" aria-label={t('Home')}>
          <CommonLogo />
        </Link>
      </div>

      <ErrorBoundary fallback={<Skeleton className="h-11 w-96" />}>
        <div
          className={cn(
            // min-w-0 lets this grid cell shrink below the field's content
            // width so the centered search narrows instead of overflowing.
            'flex min-w-0 items-center',
            isMobileSearchExpanded ? 'w-full' : 'hidden md:flex',
          )}
        >
          <SearchInput />
          <Button
            variant="ghost"
            onClick={() => setIsMobileSearchExpanded(false)}
            className={cn(
              'ms-3 text-muted-foreground',
              !isMobileSearchExpanded && 'hidden',
            )}
          >
            {t('Cancel')}
          </Button>
        </div>
      </ErrorBoundary>

      <div
        className={cn(
          'flex items-center gap-2 md:justify-self-end',
          isMobileSearchExpanded && 'hidden',
        )}
      >
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsMobileSearchExpanded(true)}
          aria-label={t('Search')}
          className="md:hidden"
        >
          <LuSearch className="size-4 text-muted-foreground" />
        </Button>
        <HeaderActions />
      </div>
    </header>
  );
};
