'use client';

import { Button, ButtonLink } from '@op/ui/Button';
import { Header1 } from '@op/ui/Header';
import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { LuArrowLeft, LuBell, LuSettings } from 'react-icons/lu';

import { usePathname, useRouter, useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import { LocaleChooser } from '../LocaleChooser';
import { UserAvatarMenu } from '../SiteHeader';

export const DecisionInstanceHeader = ({
  backTo,
  title,
  decisionSlug,
  isAdmin,
}: {
  backTo: {
    label?: string;
    href: string;
  };
  title: string;
  decisionSlug?: string;
  isAdmin?: boolean;
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

      <div className="flex items-center justify-end gap-2 md:gap-4">
        <PanelToggleButton ariaLabel={t('Open updates panel')} />
        {isAdmin && decisionSlug && (
          <ButtonLink
            href={`/decisions/${decisionSlug}/edit`}
            color="secondary"
            size="small"
          >
            <LuSettings className="size-4 text-neutral-black md:text-teal" />
            <span className="hidden md:inline">{t('Settings')}</span>
          </ButtonLink>
        )}
        <LocaleChooser />
        <UserAvatarMenu />
      </div>
    </header>
  );
};

const PANEL_TAB_QUERY_KEY = 'panelTab';
const DEFAULT_PANEL_TAB = 'updates';

const PanelToggleButton = ({ ariaLabel }: { ariaLabel: string }) => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleOpen = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.set(PANEL_TAB_QUERY_KEY, DEFAULT_PANEL_TAB);
    const newUrl = next.toString()
      ? `${pathname}?${next.toString()}`
      : pathname;
    router.replace(newUrl, { scroll: false });
  }, [pathname, router, searchParams]);

  return (
    <Button
      color="secondary"
      size="small"
      onPress={handleOpen}
      aria-label={ariaLabel}
    >
      <LuBell className="size-4 text-neutral-black md:text-teal" />
    </Button>
  );
};
