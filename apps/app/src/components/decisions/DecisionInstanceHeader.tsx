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
    <header className="p-2 px-6 sm:grid-cols-3 md:py-3 grid grid-cols-[auto_1fr_auto] items-center border-b border-neutral-gray1 bg-white">
      <div className="gap-3 flex items-center">
        <Link
          href={backTo.href}
          className="md:text-primary-teal gap-2 flex items-center text-base text-neutral-black hover:text-primary-tealBlack"
        >
          <LuArrowLeft className="size-6 md:size-4" />
          <span className="md:flex hidden">
            {t('Back')} {backTo.label ? `${t('to')} ${backTo.label}` : ''}
          </span>
        </Link>
      </div>

      <div className="flex justify-center text-center">
        <Header1 className="sm:text-title-sm font-serif text-title-sm text-neutral-charcoal">
          {title}
        </Header1>
      </div>

      <div className="gap-2 flex items-center justify-end">
        <LocaleChooser />
        <UserAvatarMenu />
      </div>
    </header>
  );
};
