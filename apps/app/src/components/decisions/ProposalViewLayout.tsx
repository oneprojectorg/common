'use client';

import type { Proposal } from '@op/common/client';
import { Button } from '@op/sense/Button';
import { ReactNode } from 'react';
import { LuArrowLeft, LuMessageCircle, LuPencil } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { useRouter } from '@/lib/i18n/routing';

import { ButtonLink } from '../ButtonLink';
import { LocaleChooser } from '../LocaleChooser';
import { JoinAccountModal, JoinOrUserMenu } from './JoinAccountModal';
import { ProposalAdminMenu } from './ProposalAdminMenu';
import { PROPOSAL_COMMENTS_ANCHOR_ID } from './ProposalComments';
import { ReportProposalDialog } from './ReportProposalDialog';
import { ReviewNotesButton } from './ReviewNotesButton';

export function ProposalViewLayout({
  children,
  backHref,
  editHref,
  canEdit = false,
  canJoin = false,
  reportProposalId,
  reviewNotesToggle,
  moderationProposal,
  notices,
}: {
  children: ReactNode;
  backHref: string;
  editHref?: string;
  canEdit?: boolean;
  /**
   * Public process (viewer can submit proposals without an account): the
   * header offers "Join" (account claim, see JoinAccountModal) instead of
   * "Log in" to logged-out and anonymous visitors.
   */
  canJoin?: boolean;
  /** When set, renders the "Report" action (opens the report dialog) for the
   *  proposal with this id. */
  reportProposalId?: string;
  reviewNotesToggle?: {
    onToggle: () => void;
    isActive: boolean;
  };
  /**
   * Admin overflow menu (hide / delete). Gates itself on
   * `proposal.access.admin`, so it's safe to pass for any viewer.
   */
  moderationProposal?: Proposal;
  /**
   * Read-only status shown at the head of the action cluster. Pass a fragment
   * for more than one; each renders nothing when it has nothing to say.
   */
  notices?: ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const backLabel = t('Back to Proposals');

  return (
    <div className="grid h-screen min-h-0 min-w-0 grid-cols-1 grid-rows-[auto_1fr] bg-white">
      {/* Header (pinned — fixed grid row above the scrolling body). Figma has no
          centred title on the read bar: the title is the body's H1, so the bar
          is a simple left cluster / action cluster split. */}
      <div className="flex h-15 items-center justify-between gap-3 border-b px-4 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="link"
            onClick={() => router.push(backHref)}
            aria-label={backLabel}
            className="px-0"
          >
            <LuArrowLeft className="size-4 rtl:-scale-x-100" />
            <span className="hidden sm:inline">{backLabel}</span>
          </Button>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {notices}
          {canEdit && editHref && (
            <Button
              variant="outline"
              onClick={() => router.push(editHref)}
              className="max-sm:size-11"
              aria-label={t('Edit')}
            >
              <LuPencil className="size-4" />
              <span className="hidden sm:inline">{t('Edit')}</span>
            </Button>
          )}
          {/* Report is a safety action the moderation API accepts from any
              caller (signed-in, anonymous, or sessionless). Offer it to any
              viewer so inappropriate content is always flaggable. */}
          {reportProposalId && (
            <ReportProposalDialog proposalId={reportProposalId} />
          )}
          {/* Mobile-only jump to the comments section (Figma's speech-bubble
              icon). A plain fragment link — no scroll scripting needed. */}
          <ButtonLink
            href={`#${PROPOSAL_COMMENTS_ANCHOR_ID}`}
            variant="outline"
            size="icon"
            aria-label={t('View comments')}
            className="sm:hidden"
          >
            <LuMessageCircle className="size-4" />
          </ButtonLink>
          {/* Like/Follow live in the proposal's engagement row, not here — see
              ProposalPreview's `engagement` prop. */}
          {reviewNotesToggle && (
            <ReviewNotesButton
              onToggle={reviewNotesToggle.onToggle}
              isExpanded={reviewNotesToggle.isActive}
            />
          )}
          {moderationProposal ? (
            <ProposalAdminMenu
              proposal={moderationProposal}
              backHref={backHref}
            />
          ) : null}
          <div className="hidden sm:block">
            <LocaleChooser />
          </div>
          {/* Outside the sm-only cluster: Join stays visible on mobile (the
              avatar keeps its desktop-only treatment via userMenuClassName). */}
          <JoinOrUserMenu
            canJoin={canJoin}
            userMenuClassName="hidden sm:block"
          />
        </div>
      </div>

      <div className="relative min-h-0 overflow-y-auto">{children}</div>

      {/* Mounted outside the sm-only header cluster so a `?join=1` deep link
          still opens the modal on mobile. */}
      {canJoin ? <JoinAccountModal /> : null}
    </div>
  );
}
