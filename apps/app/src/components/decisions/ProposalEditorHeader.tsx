'use client';

import { useUser } from '@/utils/UserProvider';
import { userCanInteract } from '@/utils/userCanInteract';
import { Button } from '@op/sense/Button';
import { Header4 } from '@op/sense/Header';
import { Separator } from '@op/sense/Separator';
import type { ReactNode } from 'react';
import { LuArrowLeft, LuCheck, LuUserPlus } from 'react-icons/lu';

import { useRouter, useTranslations } from '@/lib/i18n';

import { LocaleChooser } from '../LocaleChooser';
import { UserAvatarMenu } from '../SiteHeader';

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
  /**
   * Optional save/version status text rendered in the bar's left cluster,
   * after the proposal name (Figma: "Saved 2 min ago" / "Viewing {date}").
   */
  statusSlot?: ReactNode;
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
    <div className="sticky top-0 z-20 flex h-editor-topbar items-center justify-between gap-2 border-b bg-background px-4 sm:px-6">
      {/* Figma's left cluster: Back · separator · proposal name · saved status. */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Button
          variant="ghost"
          onClick={() => router.push(backHref)}
          className="shrink-0 text-foreground sm:text-primary"
        >
          <LuArrowLeft className="size-6 sm:size-4 rtl:-scale-x-100" />
          <span className="hidden sm:block">{t('Back')}</span>
        </Button>

        <Separator
          orientation="vertical"
          className="hidden sm:block data-vertical:h-5 data-vertical:self-center"
        />

        <Header4 className="hidden min-w-0 truncate sm:block">
          {title ? title : t('Untitled Proposal')}
        </Header4>

        {statusSlot}
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {!readOnlyMode && presenceSlot}
        {asideHeaderIcons}
        {!readOnlyMode && canShare && (
          <Button
            variant="outline"
            onClick={onShare}
            className="max-sm:size-11"
          >
            <LuUserPlus className="size-4" />
            <span className="hidden sm:inline">{t('Share')}</span>
          </Button>
        )}
        {!readOnlyMode && (
          <Button
            onClick={isRevisionMode ? onResubmit : onSubmitProposal}
            loading={isSubmitting}
          >
            <LuCheck className="size-4" />
            {isRevisionMode
              ? t('Resubmit')
              : isEditMode && !isDraft
                ? t('Update')
                : t('Submit')}
          </Button>
        )}
        <LocaleChooser />
        {/* No avatar or login for visitors/anonymous. */}
        {userCanInteract(user) ? (
          <UserAvatarMenu className="hidden sm:block" />
        ) : null}
      </div>
    </div>
  );
}
