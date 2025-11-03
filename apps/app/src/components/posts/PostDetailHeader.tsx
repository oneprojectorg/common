'use client';

import { LuArrowLeft } from 'react-icons/lu';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';
import { Skeleton } from '@op/ui/Skeleton';
import { ClientOnly } from '@/utils/ClientOnly';

import { LocaleChooser } from '../LocaleChooser';
import { UserAvatarMenu } from '../SiteHeader';
import { SearchInput } from '../SearchInput';
import { InviteUserModal } from '../InviteUserModal';
import ErrorBoundary from '../ErrorBoundary';

export const PostDetailHeader = () => {
  const t = useTranslations();
  return (
    <header className="grid grid-cols-[auto_1fr_auto] items-center border-b border-neutral-gray1 bg-white p-2 px-6 sm:grid-cols-3 md:py-3">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-base text-neutral-black hover:text-primary-tealBlack md:text-primary-teal"
        >
          <LuArrowLeft className="size-6 md:size-4" />
          <span className="hidden md:flex">{t('Home')}</span>
        </Link>
      </div>

      <div className="flex justify-center">
        <ErrorBoundary fallback={<Skeleton className="h-10 w-96" />}>
          <Suspense fallback={<Skeleton className="h-10 w-96" />}>
            <SearchInput />
          </Suspense>
        </ErrorBoundary>
      </div>

      <div className="flex items-center justify-end gap-2">
        <ClientOnly>
          <InviteUserModal />
          <LocaleChooser />
          <ErrorBoundary
            fallback={
              <div className="size-8 rounded-full border bg-white shadow" />
            }
          >
            <Suspense
              fallback={
                <Skeleton className="size-8 rounded-full border bg-white shadow" />
              }
            >
              <UserAvatarMenu />
            </Suspense>
          </ErrorBoundary>
        </ClientOnly>
      </div>
    </header>
  );
};
