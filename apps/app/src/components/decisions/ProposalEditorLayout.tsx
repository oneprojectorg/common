'use client';

import type { ProposalReviewRequest } from '@op/common/client';
import { Button } from '@op/ui/Button';
import { Header4 } from '@op/ui/Header';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { type ReactNode, useState } from 'react';
import { LuArrowLeft, LuCheck, LuShare2 } from 'react-icons/lu';

import { useRouter, useTranslations } from '@/lib/i18n';

import { LocaleChooser } from '../LocaleChooser';
import { UserAvatarMenu } from '../SiteHeader';
import { ShareProposalModal } from './ShareProposalModal';
import { ResubmitProposalModal } from './proposalEditor/ResubmitProposalModal';

interface ProposalEditorLayoutProps {
  children: ReactNode;
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
  /** Optional right-aligned status pill shown while viewing history */
  statusSlot?: ReactNode;
  /** Whether action controls should be rendered in the header */
  showHeaderActions?: boolean;
  /** When true, hide editing actions while showing a historical version. */
  readOnlyMode?: boolean;
  /** The proposal's profile ID, used for the share modal */
  proposalProfileId: string;
  /** The current user's decision permissions on this proposal */
  access?: {
    admin: boolean;
    inviteMembers: boolean;
  };
  /** Active revision request when the editor is in revision mode */
  revisionRequest?: ProposalReviewRequest | null;
}

export function ProposalEditorLayout({
  children,
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
  proposalProfileId,
  access,
  revisionRequest,
}: ProposalEditorLayoutProps) {
  const router = useRouter();
  const t = useTranslations();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isResubmitModalOpen, setIsResubmitModalOpen] = useState(false);

  const canShare = access?.admin || access?.inviteMembers;
  const isRevisionMode = Boolean(revisionRequest);

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-white">
      <div className="flex h-editor-topbar items-center justify-between gap-2 border-b px-4 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:px-6">
        <button
          onClick={() => router.push(backHref)}
          className="flex cursor-pointer items-center gap-2 text-primary hover:text-primary"
        >
          <LuArrowLeft className="size-6 text-foreground sm:size-4 sm:text-primary" />
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
                  variant="outline"
                  size="icon-sm"
                  onPress={() => setIsShareModalOpen(true)}
                >
                  <LuShare2 className="size-4" />
                  <span className="hidden sm:inline">{t('Share')}</span>
                </Button>
              )}
              {!readOnlyMode && (
                <Button
                  variant="default"
                  size="icon-sm"
                  onPress={
                    isRevisionMode
                      ? () => setIsResubmitModalOpen(true)
                      : onSubmitProposal
                  }
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
              <UserAvatarMenu className="hidden sm:block" />
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">{children}</div>

      {canShare && (
        <ShareProposalModal
          proposalProfileId={proposalProfileId}
          proposalTitle={title}
          isOpen={isShareModalOpen}
          onOpenChange={setIsShareModalOpen}
        />
      )}

      {revisionRequest && (
        <ResubmitProposalModal
          isOpen={isResubmitModalOpen}
          onOpenChange={setIsResubmitModalOpen}
          revisionRequestId={revisionRequest.id}
          backHref={backHref}
        />
      )}
    </div>
  );
}
