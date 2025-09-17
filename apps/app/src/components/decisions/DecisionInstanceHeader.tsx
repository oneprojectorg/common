'use client';

import { Header1 } from '@op/ui/Header';
import { LuArrowLeft } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import { LocaleChooser } from '../LocaleChooser';
import { UserAvatarMenu } from '../SiteHeader';

interface DecisionInstanceHeaderProps {
  backTo: {
    label?: string;
    href: string;
  };
  title: string;
}

export function DecisionInstanceHeader({
  backTo,
  title,
}: DecisionInstanceHeaderProps) {
  const t = useTranslations();
  return (
    <header className="flex items-center justify-between border-b border-neutral-gray1 bg-white p-2 px-6 sm:py-3">
      <div className="flex items-center gap-3">
        <Link
          href={backTo.href}
          className="flex items-center gap-2 text-base text-neutral-black hover:text-primary-tealBlack sm:text-primary-teal"
        >
          <LuArrowLeft className="size-6 stroke-1 sm:size-4" />
          <span className="hidden sm:flex">
            {t('Back')} {backTo.label ? `${t('to')} ${backTo.label}` : ''}
          </span>
        </Link>
      </div>

      <div className="text-center">
        <Header1 className="font-serif text-title-sm text-neutral-charcoal">
          {title}
        </Header1>
      </div>

      <div className="flex items-center gap-2">
        <LocaleChooser />
        <UserAvatarMenu />
      </div>
    </header>
  );
}
