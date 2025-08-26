'use client';

import { ChevronLeft } from 'lucide-react';
import { Link } from '@/lib/i18n/routing';

import { useTranslations } from '@/lib/i18n';

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
    <header className="flex items-center justify-between border-b border-neutral-gray1 bg-white px-6 py-4">
      <div className="flex items-center gap-3">
        <Link
          href={backTo.href}
          className="flex items-center gap-2 text-sm text-primary-teal hover:text-primary-tealBlack"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>
            {t('Back')} {backTo.label ? `${t('to')} ${backTo.label}` : ''}
          </span>
        </Link>
      </div>

      <div className="text-center">
        <h1 className="text-lg font-medium text-neutral-charcoal">{title}</h1>
      </div>

      <div className="flex items-center">
        <UserAvatarMenu />
      </div>
    </header>
  );
}
