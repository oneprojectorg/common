'use client';

import { Header1 } from '@op/ui/Header';
import { LuArrowLeft } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import { LocaleChooser } from '../LocaleChooser';
import { UserAvatarMenu } from '../SiteHeader';

export const DecisionInstanceHeader = ({
  backTo,
  title,
}: {
  backTo: {
    label?: string;
    href: string;
  };
  title: string;
}) => {
  const t = useTranslations();
  return (
    <header className="border-neutral-gray1 grid grid-cols-[auto_1fr_auto] items-center border-b bg-white p-2 px-6 sm:grid-cols-3 md:py-3">
      <div className="flex items-center gap-3">
        <Link
          href={backTo.href}
          className="md:text-primary-teal text-neutral-black hover:text-primary-tealBlack flex items-center gap-2 text-base"
        >
          <LuArrowLeft className="size-6 md:size-4" />
          <span className="hidden md:flex">
            {t('Back')} {backTo.label ? `${t('to')} ${backTo.label}` : ''}
          </span>
        </Link>
      </div>

      <div className="flex justify-center text-center">
        <Header1 className="sm:text-title-sm text-title-sm text-neutral-charcoal font-serif">
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
