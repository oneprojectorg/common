'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { ButtonLink } from '@op/ui/Button';
import { Header1 } from '@op/ui/Header';
import { IconButton } from '@op/ui/IconButton';
import { useQueryState } from 'nuqs';
import { LuArrowLeft, LuMegaphone, LuSettings } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import { LocaleChooser } from '../LocaleChooser';
import { UserAvatarMenu } from '../SiteHeader';
import { panelStateParser } from './DecisionSidePanel';

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
        <DecisionUpdatesToggle ariaLabel={t('Open updates panel')} />
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

const DecisionUpdatesToggle = ({ ariaLabel }: { ariaLabel: string }) => {
  const [, setPanel] = useQueryState('panel', panelStateParser);
  const decisionUpdatesEnabled = useFeatureFlag('decision_updates');

  if (!decisionUpdatesEnabled) {
    return null;
  }

  return (
    <IconButton
      variant="outline"
      size="small"
      onPress={() => setPanel('updates')}
      aria-label={ariaLabel}
    >
      <LuMegaphone className="size-4 text-neutral-black md:text-teal" />
    </IconButton>
  );
};
