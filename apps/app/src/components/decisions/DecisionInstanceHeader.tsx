'use client';

import { useUser } from '@/utils/UserProvider';
import { userCanInteract } from '@/utils/userCanInteract';
import { Button } from '@op/sense/Button';
import { Header2 } from '@op/sense/Header';
import { MegaphoneIcon } from '@op/sense/icons';
import { cn } from '@op/sense/lib/utils';
import { useQueryState } from 'nuqs';
import { type ReactNode, Suspense } from 'react';
import { LuArrowLeft, LuSettings } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import { ButtonLink } from '@/components/ButtonLink';

import { LocaleChooser } from '../LocaleChooser';
import { SupportLink } from '../SupportLink';
import { JoinOrUserMenu } from './JoinAccountModal';
import { panelStateParser } from './panelState';

export const DecisionInstanceHeader = ({
  backTo,
  title,
  decisionSlug,
  isAdmin,
  canReadUpdates = false,
  canJoin = false,
  centerSlot,
  mobileAdminBar,
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
   * Public process: offer "Join" (account claim, see JoinAccountModal) instead
   * of "Log in" to logged-out and anonymous visitors.
   */
  canJoin?: boolean;
  /**
   * Optional content for the header's center column (e.g. the Overview /
   * Current Phase toggle). When provided, on md+ the title moves beside the
   * Back link so the center stays reserved for the slot; on mobile the title
   * stays centered and the slot floats below the sticky header instead.
   * Otherwise the title is centered as before.
   */
  centerSlot?: ReactNode;
  /**
   * Full-width admin bar rendered flush below the header row on mobile (e.g.
   * the overview admin bar). Sits inside the sticky <header> so the floating
   * centerSlot toggle (top-full) lands below it.
   */
  mobileAdminBar?: ReactNode;
}) => {
  const t = useTranslations();
  const { user } = useUser();
  // Hide the Back link for users who can't interact (logged-out visitors and
  // anonymous accounts) — they have nowhere meaningful to go "back" to.
  const canInteract = userCanInteract(user);

  // Fixed height (48/56px) keeps the header steady as the center toggle grows,
  // and matches DecisionSidePanel's sm:top-12 md:top-14 so the panel meets it.
  return (
    <header className="sticky top-0 z-30 border-b bg-white">
      <div className="grid h-14 grid-cols-[auto_1fr_auto] items-center px-4 sm:grid-cols-3 md:px-6">
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
              <DecisionTitle title={title} className="hidden md:block" />
            </>
          ) : null}
        </div>

        <div className="flex min-w-0 justify-center text-center">
          {centerSlot ? (
            <>
              <div className="hidden md:flex">{centerSlot}</div>
              <DecisionTitle title={title} className="md:hidden" />
            </>
          ) : (
            <DecisionTitle title={title} />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 md:gap-3">
          {/*
           * The toggle reads the `panel` search param via nuqs (useSearchParams).
           * When this header renders inside the decision-view layout — which Next
           * prerenders as the route's static shell because of its loading.tsx —
           * that read happens outside a request scope and throws. The Suspense
           * boundary defers it out of the shell. Fallback is null because the
           * toggle is non-critical chrome and may itself render null.
           */}
          {isAdmin && decisionSlug && (
            <ButtonLink
              href={`/decisions/${decisionSlug}/edit`}
              variant="outline"
              aria-label={t('Settings')}
              className="sm:w-auto sm:gap-2 sm:px-4"
              size="icon"
            >
              <LuSettings className="size-4" />
              <span className="hidden sm:inline-block">{t('Settings')}</span>
            </ButtonLink>
          )}
          <Suspense fallback={null}>
            <DecisionUpdatesToggle
              ariaLabel={t('Toggle updates panel')}
              canReadUpdates={canReadUpdates}
            />
          </Suspense>
          <SupportLink />
          <LocaleChooser />
          <JoinOrUserMenu canJoin={canJoin} />
        </div>
      </div>

      {mobileAdminBar}

      {centerSlot ? (
        <div className="pointer-events-none absolute inset-x-0 top-full z-50 flex justify-center md:hidden">
          <div className="pointer-events-auto pt-2">{centerSlot}</div>
        </div>
      ) : null}
    </header>
  );
};

const DecisionTitle = ({
  title,
  className,
}: {
  title: string;
  className?: string;
}) => (
  <Header2 className={cn('truncate font-serif text-label', className)}>
    <bdi>{title}</bdi>
  </Header2>
);

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
    <Button
      variant="outline"
      size="icon"
      onClick={() => setPanel(isOpen ? null : 'updates')}
      aria-label={ariaLabel}
      aria-pressed={isOpen}
      className={
        isOpen ? 'bg-primary-tealWhite text-primary-teal' : 'text-neutral-black'
      }
    >
      <MegaphoneIcon className="size-4 stroke-[1.5]" />
    </Button>
  );
};
