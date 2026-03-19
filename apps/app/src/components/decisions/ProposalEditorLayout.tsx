'use client';

import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Button } from '@op/ui/Button';
import { Header4 } from '@op/ui/Header';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { LuArrowLeft, LuCheck, LuShare2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { LocaleChooser } from '../LocaleChooser';
import { UserAvatarMenu } from '../SiteHeader';
import { ShareProposalModal } from './ShareProposalModal';

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
  /** Optional slot for header actions such as aside triggers */
  headerActions?: ReactNode;
  /** Optional slot for a sidebar panel (e.g. version history) */
  sidebarSlot?: ReactNode;
  /** The proposal's profile ID, used for the share modal */
  proposalProfileId: string;
  /** The current user's decision permissions on this proposal */
  access?: {
    admin: boolean;
    inviteMembers: boolean;
  };
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
  headerActions,
  sidebarSlot,
  proposalProfileId,
  access,
}: ProposalEditorLayoutProps) {
  const router = useRouter();
  const t = useTranslations();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`) ?? false;

  const canShare = access?.admin || access?.inviteMembers;
  const showHeaderActions = isMobile || !sidebarSlot;

  return (
    <div className="flex h-screen bg-white">
      {/* Main column: header + editor content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex h-editor-topbar items-center justify-between gap-2 border-b px-4 sm:grid sm:grid-cols-3 sm:justify-normal sm:px-6">
          <button
            onClick={() => router.push(backHref)}
            className="flex items-center gap-2 text-primary-teal hover:text-primary-tealBlack"
          >
            <LuArrowLeft className="size-6 text-neutral-charcoal sm:size-4 sm:text-primary-teal" />
            <span className="hidden sm:block">{t('Back')}</span>
          </button>

          <div className="hidden justify-center sm:flex">
            <Header4 className="hidden sm:block">
              {title ? title : t('Untitled Proposal')}
            </Header4>
          </div>

          <div className="flex items-center justify-end gap-4">
            {showHeaderActions && (
              <>
                {presenceSlot}
                {headerActions}
                {canShare && (
                  <Button
                    color="secondary"
                    variant="icon"
                    size="small"
                    onPress={() => setIsShareModalOpen(true)}
                  >
                    <LuShare2 className="size-4" />
                    <span className="hidden sm:inline">{t('Share')}</span>
                  </Button>
                )}
                <Button
                  color="primary"
                  variant="icon"
                  size="small"
                  onPress={onSubmitProposal}
                  isDisabled={isSubmitting}
                  className="px-4 py-2"
                >
                  {isSubmitting ? <LoadingSpinner /> : <LuCheck />}
                  {isEditMode && !isDraft ? (
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
                <LocaleChooser />
                <UserAvatarMenu className="hidden sm:block" />
              </>
            )}
          </div>
        </div>

        {/* Scrollable editor body */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>

      {/* Full-height sidebar (sits beside entire main column) */}
      {sidebarSlot}

      {canShare && (
        <ShareProposalModal
          proposalProfileId={proposalProfileId}
          proposalTitle={title}
          isOpen={isShareModalOpen}
          onOpenChange={setIsShareModalOpen}
        />
      )}
    </div>
  );
}
