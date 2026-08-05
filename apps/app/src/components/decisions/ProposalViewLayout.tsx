'use client';

import type { Proposal } from '@op/common/client';
import { Button } from '@op/sense/Button';
import { Separator } from '@op/sense/Separator';
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

/**
 * Every action in the header row collapses to an icon-only square below `sm`
 * (Figma 19626:26574 — the mobile read view is a back arrow plus a row of icon
 * buttons) and shows its label from `sm` up.
 */
const COMPACT_ACTION_CLASSES = 'max-sm:size-8 max-sm:px-0';

export function ProposalViewLayout({
  children,
  backHref,
  title,
  editHref,
  canEdit = false,
  canJoin = false,
  reportProposalId,
  revisionToggle,
  moderationProposal,
}: {
  children: ReactNode;
  backHref: string;
  title?: string;
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
   * When provided, renders a sticky-note toggle button in the header with an
   * orange indicator dot. `isActive` reflects the aria-pressed state.
   */
  revisionToggle?: {
    onToggle: () => void;
    isActive: boolean;
  };
  /**
   * When set, renders the admin overflow menu (shortlist / reject / hide) for
   * this proposal. The menu gates itself on `proposal.access.admin`, so passing
   * it for a non-admin viewer renders nothing.
   */
  moderationProposal?: Proposal;
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

          {title ? (
            <>
              <Separator
                orientation="vertical"
                className="hidden h-5 sm:block"
              />
              <span className="hidden truncate text-base text-foreground sm:block">
                {title}
              </span>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {canEdit && editHref && (
            <Button
              variant="outline"
              onClick={() => router.push(editHref)}
              aria-label={t('Edit')}
              className={COMPACT_ACTION_CLASSES}
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
            aria-label={t('View comments')}
            className="size-8 px-0 sm:hidden"
          >
            <LuMessageCircle className="size-4" />
          </ButtonLink>
          {/* Like/Follow live in the proposal's engagement row, not here — see
              ProposalPreview's `engagement` prop. */}
          {/* `delay` lives on the provider, not the Tooltip root — wrap locally
              to keep the slower @op/ui hover feel on this one control. */}
          {revisionToggle && (
            <TooltipProvider delay={500}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={revisionToggle.onToggle}
                      aria-label={revisionRequestLabel}
                      aria-pressed={revisionToggle.isActive}
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
            </TooltipProvider>
          )}
          {moderationProposal ? (
            <ProposalAdminMenu proposal={moderationProposal} />
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
