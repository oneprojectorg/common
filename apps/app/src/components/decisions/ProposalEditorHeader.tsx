'use client';

import { useUser } from '@/utils/UserProvider';
import { userCanInteract } from '@/utils/userCanInteract';
import { Button } from '@op/ui/Button';
import { Header4 } from '@op/ui/Header';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import type { ReactNode } from 'react';
import { LuArrowLeft, LuCheck, LuUserPlus } from 'react-icons/lu';

import { useRouter, useTranslations } from '@/lib/i18n';

import { LocaleChooser } from '../LocaleChooser';
import { UserAvatarMenu } from '../SiteHeader';
import { JoinAccountModal, JoinDecisionButton } from './JoinAccountModal';

interface ProposalEditorHeaderProps {
  backHref: string;
  title: string;
  onSubmitProposal: () => void;
  isSubmitting: boolean;
  isEditMode?: boolean;
  isDraft?: boolean;
  /** Optional slot for presence indicators (avatar stack) */
  presenceSlot?: ReactNode;
  /** Optional slot for aside trigger icons in the header */
  asideHeaderIcons?: ReactNode;
  /** Optional end-aligned status pill shown while viewing history */
  statusSlot?: ReactNode;
  /** Whether action controls should be rendered in the header */
  showHeaderActions?: boolean;
  /** When true, hide editing actions while showing a historical version. */
  readOnlyMode?: boolean;
  /** Whether the current user can share the proposal */
  canShare: boolean;
  /** Whether the editor is in revision mode */
  isRevisionMode: boolean;
  onShare: () => void;
  onResubmit: () => void;
}

export function ProposalEditorHeader({
  backHref,
  title,
  onSubmitProposal,
  isSubmitting,
  isEditMode = false,
  isDraft = false,
  presenceSlot,
  asideHeaderIcons,
  statusSlot,
  showHeaderActions = true,
  readOnlyMode = false,
  canShare,
  isRevisionMode,
  onShare,
  onResubmit,
}: ProposalEditorHeaderProps) {
  const router = useRouter();
  const t = useTranslations();
  const { user } = useUser();

  return (
    <div className="sticky top-0 z-20 flex h-editor-topbar items-center justify-between gap-2 border-b bg-white px-4 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:px-6">
      <button
        onClick={() => router.push(backHref)}
        className="flex cursor-pointer items-center gap-2 text-primary-teal hover:text-primary-tealBlack"
      >
        <LuArrowLeft className="size-6 text-neutral-charcoal sm:size-4 sm:text-primary-teal rtl:-scale-x-100" />
        <span className="hidden sm:block">{t('Back')}</span>
      </button>

      <Header4 className="hidden min-w-0 truncate sm:block">
        {title ? title : t('Untitled Proposal')}
      </Header4>

      <div className="flex items-center justify-end gap-4">
        {statusSlot}
        {showHeaderActions && (
          <>
            {!readOnlyMode && presenceSlot}
            {asideHeaderIcons}
            {!readOnlyMode && canShare && (
              <Button
                color="secondary"
                variant="icon"
                size="small"
                onPress={onShare}
              >
                <LuUserPlus className="size-4" />
                <span className="hidden sm:inline">{t('Share')}</span>
              </Button>
            )}
            {!readOnlyMode && (
              <Button
                color="primary"
                variant="icon"
                size="small"
                onPress={isRevisionMode ? onResubmit : onSubmitProposal}
                isDisabled={isSubmitting}
                className="px-4 py-2"
              >
                {isSubmitting ? <LoadingSpinner /> : <LuCheck />}
                {isRevisionMode ? (
                  t('Resubmit')
                ) : isEditMode && !isDraft ? (
                  <>
                    <span className="inline lg:hidden">{t('Update')}</span>
                    <span className="hidden lg:inline">
                      {t('Update Proposal')}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:block">
                      {t('Submit Proposal')}
                    </span>
                    <span className="sm:hidden">{t('Submit')}</span>{' '}
                  </>
                )}
              </Button>
            )}
            <LocaleChooser />
            {userCanInteract(user) ? (
              <UserAvatarMenu className="hidden sm:block" />
            ) : (
              /*
               * The only non-interactive viewer who can reach the editor is an
               * anonymous drafter on a public process (logged-out visitors 403
               * at getProposal), so no canJoin plumbing is needed here. The
               * claim links the email onto their existing anon session, which
               * owns this draft — the proposal follows to the new account
               * automatically.
               */
              <>
                <JoinDecisionButton className="hidden sm:block" />
                <JoinAccountModal />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
