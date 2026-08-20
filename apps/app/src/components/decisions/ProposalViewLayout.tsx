'use client';

import type { Proposal } from '@op/common/client';
import { Button } from '@op/sense/Button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@op/sense/Tooltip';
import { ReactNode } from 'react';
import {
  LuArrowLeft,
  LuMessageCircle,
  LuPencil,
  LuStickyNote,
} from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { useRouter } from '@/lib/i18n/routing';

import { ButtonLink } from '../ButtonLink';
import { LocaleChooser } from '../LocaleChooser';
import { JoinAccountModal, JoinOrUserMenu } from './JoinAccountModal';
import { ProposalAdminMenu } from './ProposalAdminMenu';
import { PROPOSAL_COMMENTS_ANCHOR_ID } from './ProposalComments';
import { ReportProposalDialog } from './ReportProposalDialog';

export function ProposalViewLayout({
  children,
  backHref,
  editHref,
  canEdit = false,
  canJoin = false,
  reportProposalId,
  revisionToggle,
  moderationProposal,
  mergeNotice,
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
  /**
   * When provided, renders a sticky-note disclosure button in the header with
   * an orange indicator dot. `isActive` reflects the aria-expanded state.
   */
  revisionToggle?: {
    onToggle: () => void;
    isActive: boolean;
  };
  /**
   * Admin overflow menu (hide / delete). Gates itself on
   * `proposal.access.admin`, so it's safe to pass for any viewer.
   */
  moderationProposal?: Proposal;
  /**
   * "Merged into <survivor>" for a superseded proposal (Figma 15367:51167).
   * A slot rather than a `Proposal`, so the layout doesn't need the decision
   * route to build the survivor's link. Renders nothing when unmerged.
   */
  mergeNotice?: ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const revisionRequestLabel = t('Revision request');
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

        {/* One tooltip group for the row — `delay` exists on Provider alone. */}
        <TooltipProvider delay={500}>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Leads the action cluster: it's a record, not an action, so it
              reads before the buttons rather than among them. */}
            {mergeNotice}
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
            {revisionToggle && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={revisionToggle.onToggle}
                      aria-label={revisionRequestLabel}
                      aria-expanded={revisionToggle.isActive}
                      className="relative"
                    >
                      <LuStickyNote className="size-4" />
                      <span
                        aria-hidden
                        className="absolute -end-0.5 -top-0.5 size-1.5 rounded-full bg-warning"
                      />
                    </Button>
                  }
                />
                <TooltipContent>{revisionRequestLabel}</TooltipContent>
              </Tooltip>
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
        </TooltipProvider>
      </div>

      <div className="relative min-h-0 overflow-y-auto">{children}</div>

      {/* Mounted outside the sm-only header cluster so a `?join=1` deep link
          still opens the modal on mobile. */}
      {canJoin ? <JoinAccountModal /> : null}
    </div>
  );
}
