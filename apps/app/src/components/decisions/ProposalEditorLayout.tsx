'use client';

import { useUser } from '@/utils/UserProvider';
import { userCanInteract } from '@/utils/userCanInteract';
import type { ProposalReviewRequest } from '@op/common/client';
import { type ReactNode, useState } from 'react';

import { ProposalEditorHeader } from './ProposalEditorHeader';
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
  /** Optional save/version status text shown in the header's left cluster */
  statusSlot?: ReactNode;
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
  readOnlyMode = false,
  proposalProfileId,
  access,
  revisionRequest,
}: ProposalEditorLayoutProps) {
  const { user } = useUser();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isResubmitModalOpen, setIsResubmitModalOpen] = useState(false);

  // Sharing is a write surface — only offer it to signed-in, non-anonymous
  // members, on top of the existing admin/invite permission check.
  const canShare = Boolean(
    userCanInteract(user) && (access?.admin || access?.inviteMembers),
  );
  const isRevisionMode = Boolean(revisionRequest);

  return (
    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-[auto_1fr] bg-background">
      <ProposalEditorHeader
        backHref={backHref}
        title={title}
        onSubmitProposal={onSubmitProposal}
        isSubmitting={isSubmitting}
        isEditMode={isEditMode}
        isDraft={isDraft}
        presenceSlot={presenceSlot}
        asideHeaderIcons={asideHeaderIcons}
        statusSlot={statusSlot}
        readOnlyMode={readOnlyMode}
        canShare={canShare}
        isRevisionMode={isRevisionMode}
        onShare={() => setIsShareModalOpen(true)}
        onResubmit={() => setIsResubmitModalOpen(true)}
      />

      <div className="min-h-0 overflow-hidden">{children}</div>

      {canShare && (
        <ShareProposalModal
          proposalProfileId={proposalProfileId}
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
