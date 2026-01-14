'use client';

import { ClientOnly } from '@/utils/ClientOnly';
import { Skeleton } from '@op/ui/Skeleton';
import { Suspense } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import ErrorBoundary from '../ErrorBoundary';
import { LocaleChooser } from '../LocaleChooser';
import { SearchInput } from '../SearchInput';
import { UserAvatarMenu } from '../SiteHeader';
import { CreateMenu } from '../SiteHeader/CreateMenu';

export const PostDetailHeader = () => {
  const t = useTranslations();
  return (
    <header className="grid grid-cols-[auto_1fr_auto] items-center border-b bg-white p-2 px-6 sm:grid-cols-3 md:py-3">
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
        <ErrorBoundary>
          <Suspense fallback={<Skeleton className="h-10 w-96" />}>
            <SearchInput />
          </Suspense>
        </ErrorBoundary>
      </div>

      <div className="flex items-center justify-end gap-2">
        <ClientOnly>
          <CreateMenu />
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
