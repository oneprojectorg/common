'use client';

import { Avatar, AvatarFallback } from '@op/sense/Avatar';
import { SidebarTrigger } from '@op/sense/Sidebar';
import { Skeleton } from '@op/sense/Skeleton';
import { LuAlignJustify } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { CommonLogo } from '@/components/CommonLogo';
import ErrorBoundary from '@/components/ErrorBoundary';
import { LocaleChooser } from '@/components/LocaleChooser';
import { SearchInput } from '@/components/SearchInput';

import { PrototypeCreateMenu } from './PrototypeCreateMenu';
import { PROTOTYPE_USER } from './fakeUser';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * Mirrors `SiteHeader`'s markup so the prototype sits in the real chrome. The
 * differences are all about not having a backend: the account menu is a plain
 * avatar rather than the query-driven `UserAvatarMenu`, and search is present
 * but returns nothing.
 */
export function PrototypeSiteHeader() {
  const t = useTranslations();
  const initials = PROTOTYPE_USER.name
    ?.split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2);

  return (
    /* `h-14`, which is what the process and phase bars that replace this one
       are — left to size itself it came out 61 and the chrome shifted every
       time you moved between them. */
    <header className="relative z-20 flex h-14 w-full items-center justify-between gap-3 border-b border-border bg-background px-4 md:grid md:grid-cols-[1fr_auto_1fr] md:px-6">
      <div className="flex items-center gap-3">
        <SidebarTrigger
          aria-label={t('Open menu')}
          className="size-8 rounded-lg md:size-11"
        >
          <LuAlignJustify className="size-4" />
        </SidebarTrigger>
        <CommonLogo />
      </div>

      <ErrorBoundary fallback={<Skeleton className="h-11 w-96" />}>
        <div className="hidden min-w-0 items-center md:flex">
          <SearchInput />
        </div>
      </ErrorBoundary>

      <div className="flex items-center gap-2 md:justify-self-end">
        <PrototypeCreateMenu />
        <LocaleChooser />
        <Avatar className="size-10 border shadow">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
