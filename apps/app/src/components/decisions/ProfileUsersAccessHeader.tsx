'use client';

import { Header1 } from '@op/ui/Header';
import type { ReactNode } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import { LocaleChooser } from '../LocaleChooser';
import { UserAvatarMenu } from '../SiteHeader';

export const ProfileUsersAccessHeader = ({
  backTo,
  title,
}: {
  backTo: {
    label?: string;
    href: string;
  };
  title: ReactNode;
}) => {
  const t = useTranslations();
  return (
    <header className="grid grid-cols-[auto_1fr_auto] items-center border-b bg-white p-2 px-6 sm:grid-cols-3 md:py-3">
      <div className="flex items-center gap-3">
        <Link
          href={backTo.href}
          className="flex items-center gap-2 text-base text-neutral-black hover:text-primary-tealBlack md:text-primary-teal"
        >
          <LuArrowLeft className="size-6 md:size-4" />
          <span className="hidden md:flex">
            {t('Back')} {backTo.label ? `${t('to')} ${backTo.label}` : ''}
          </span>
        </Link>
      </div>

      <div className="flex justify-center text-center">
        <Header1 className="font-serif text-title-sm text-neutral-charcoal sm:text-title-sm">
          {title}
        </Header1>
      </div>

      <div className="flex items-center justify-end gap-2">
        <LocaleChooser />
        <UserAvatarMenu />
      </div>
    </header>
  );
};
