'use client';

import { useUser } from '@/utils/UserProvider';
import { userCanInteract } from '@/utils/userCanInteract';
import { ButtonLink } from '@op/ui/Button';
import { Header1 } from '@op/ui/Header';
import { IconButton } from '@op/ui/IconButton';
import { MegaphoneIcon } from '@op/ui/MegaphoneIcon';
import { useQueryState } from 'nuqs';
import { type ReactNode, Suspense } from 'react';
import { LuArrowLeft, LuSettings } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import { LocaleChooser } from '../LocaleChooser';
import { HeaderUserMenu } from '../SiteHeader';
import { panelStateParser } from './panelState';

export const DecisionInstanceHeader = ({
  backTo,
  title,
  decisionSlug,
  isAdmin,
  canReadUpdates = false,
  centerSlot,
}: {
  backTo: {
    label?: string;
    href: string;
  };
  title: string;
  decisionSlug?: string;
  isAdmin?: boolean;
  canReadUpdates?: boolean;
  /**
   * Optional content for the header's center column (e.g. the Overview /
   * Current Phase toggle). When provided, on md+ the title moves beside the
   * Back link so the center stays reserved for the slot; on mobile the title
   * stays centered and the slot floats below the sticky header instead.
   * Otherwise the title is centered as before.
   */
  centerSlot?: ReactNode;
}) => {
  const t = useTranslations();
  const { user } = useUser();
  // Hide the Back link for users who can't interact (logged-out visitors and
  // anonymous accounts) — they have nowhere meaningful to go "back" to.
  const canInteract = userCanInteract(user);

  return (
    <header className="sticky top-0 z-10 grid grid-cols-[auto_1fr_auto] items-center border-b bg-white p-2 px-4 sm:grid-cols-3 md:px-6 md:py-3">
      <div className="flex min-w-0 items-center gap-3">
        {canInteract && (
          <Link
            href={backTo.href}
            className="flex shrink-0 items-center gap-2 text-base text-neutral-black hover:text-primary-tealBlack md:text-primary-teal"
          >
            <LuArrowLeft className="size-6 md:size-4 rtl:-scale-x-100" />
            <span className="hidden md:flex">
              {t('Back')} {backTo.label ? `${t('to')} ${backTo.label}` : ''}
            </span>
          </Link>
        )}
        {centerSlot ? (
          <>
            {canInteract && (
              <span
                aria-hidden
                className="hidden h-6 w-px shrink-0 bg-neutral-gray2 md:block"
              />
            )}
            <Header1 className="hidden truncate font-serif text-title-sm text-neutral-charcoal sm:text-title-sm md:block">
              <bdi>{title}</bdi>
            </Header1>
          </>
        ) : null}
      </div>

      <div className="flex min-w-0 justify-center text-center">
        {centerSlot ? (
          <>
            <div className="hidden md:flex">{centerSlot}</div>
            <Header1 className="truncate font-serif text-title-sm text-neutral-charcoal md:hidden">
              <bdi>{title}</bdi>
            </Header1>
          </>
        ) : (
          <Header1 className="truncate font-serif text-title-sm text-neutral-charcoal sm:text-title-sm">
            <bdi>{title}</bdi>
          </Header1>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 md:gap-4">
        {/*
         * The toggle reads the `panel` search param via nuqs (useSearchParams).
         * When this header renders inside the decision-view layout — which Next
         * prerenders as the route's static shell because of its loading.tsx —
         * that read happens outside a request scope and throws. The Suspense
         * boundary defers it out of the shell. Fallback is null because the
         * toggle is non-critical chrome and may itself render null.
         */}
        <Suspense fallback={null}>
          <DecisionUpdatesToggle
            ariaLabel={t('Toggle updates panel')}
            canReadUpdates={canReadUpdates}
          />
        </Suspense>
        {isAdmin && decisionSlug && (
          <ButtonLink
            href={`/decisions/${decisionSlug}/edit`}
            color="secondary"
            size="small"
            className="p-2"
            aria-label={t('Settings')}
          >
            <LuSettings className="size-4" />
          </ButtonLink>
        )}
        <LocaleChooser />
        <HeaderUserMenu />
      </div>

      {centerSlot ? (
        <div className="pointer-events-none absolute inset-x-0 top-full flex justify-center pt-4 md:hidden">
          <div className="pointer-events-auto">{centerSlot}</div>
        </div>
      ) : null}
    </header>
  );
};

const DecisionUpdatesToggle = ({
  ariaLabel,
  canReadUpdates,
}: {
  ariaLabel: string;
  canReadUpdates: boolean;
}) => {
  const [panel, setPanel] = useQueryState('panel', panelStateParser);

  if (!canReadUpdates) {
    return null;
  }

  const isOpen = panel !== null;

  return (
    <IconButton
      variant="outline"
      size="medium"
      onPress={() => setPanel(isOpen ? null : 'updates')}
      aria-label={ariaLabel}
      aria-pressed={isOpen}
      className={
        isOpen ? 'bg-primary-tealWhite text-primary-teal' : 'text-neutral-black'
      }
    >
      <MegaphoneIcon className="size-4" />
    </IconButton>
  );
};
