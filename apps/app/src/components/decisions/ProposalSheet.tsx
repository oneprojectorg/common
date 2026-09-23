'use client';

import {
  canEngageWithProposals,
  useProposalEngagement,
} from '@/hooks/useProposalEngagement';
import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { Button } from '@op/sense/Button';
import { useDirection } from '@op/sense/Direction';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Sheet, SheetContent, SheetTitle } from '@op/sense/Sheet';
import { Skeleton, SkeletonText } from '@op/sense/Skeleton';
import { Suspense, useState } from 'react';
import { LuExpand, LuTriangleAlert, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '../ButtonLink';
import { ContributingIdeas } from './ContributingIdeas';
import { ProposalComments } from './ProposalComments';
import { ProposalPreview, toPreviewEngagement } from './ProposalPreview';
import {
  type ProposalRoute,
  decisionRootHref,
  proposalHref,
} from './proposalHrefs';
import { useCommentsAllowed } from './useCommentsAllowed';

export type ProposalSheetRoute = Omit<ProposalRoute, 'profileId'>;

/**
 * A proposal read in a panel beside the list it was opened from, rather than on
 * its own page (Figma 19755-7774). Keeping the list mounted is the whole point:
 * the filters, the scroll position and the map's viewport all survive a read,
 * which a navigation to `/proposal/:id` throws away.
 *
 * Body composition matches {@link ReviewProposalPane} — the same
 * `ProposalPreview` the proposal page renders, then the merged-in ideas and the
 * comments. What the page keeps to itself is what a panel can't host: the read
 * bar, the review-notes split pane, and the translate flow. The header's expand
 * control hands the reader over to that page.
 */
export function ProposalSheet({
  profileId,
  route,
  onClose,
}: {
  /** Profile id of the proposal to show; `null` keeps the sheet closed. */
  profileId: string | null;
  route: ProposalSheetRoute;
  onClose: () => void;
}) {
  const t = useTranslations();
  // `side` is physical, so it has to be mirrored to stay at the inline end.
  const isRtl = useDirection() === 'rtl';

  const shownProfileId = useLastOpenProposal(profileId);

  return (
    <Sheet
      open={profileId !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <SheetContent
        side={isRtl ? 'left' : 'right'}
        // Our own close button instead of the built-in one: sense is
        // i18n-agnostic and labels its close "Close" in English.
        showCloseButton={false}
        // Wider than the default side panel: this carries a whole proposal,
        // and the page's own reading column is 544px.
        className="w-full gap-0 p-0 sm:max-w-2xl"
      >
        {/* The proposal's own H1 is inside the scroll area and arrives with the
            query, so the dialog's accessible name is this static one. */}
        <SheetTitle className="sr-only">
          {t('decisions.proposals.proposalLabel')}
        </SheetTitle>

        <div className="flex shrink-0 items-center justify-end gap-1 border-b px-4 py-3">
          {shownProfileId ? (
            <ButtonLink
              href={proposalHref({ ...route, profileId: shownProfileId })}
              variant="ghost"
              size="icon-sm"
              aria-label={t('decisions.proposals.openFullProposalAction')}
            >
              <LuExpand className="size-4" />
            </ButtonLink>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label={t('Close')}
          >
            <LuX className="size-5" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Keyed on the proposal, so opening a second one after the first
              failed gets a fresh boundary — an error boundary latches, and
              without this the panel would stay on the failure for the rest of
              the session. */}
          {shownProfileId ? (
            <APIErrorBoundary
              key={shownProfileId}
              fallbacks={{ default: () => <ProposalUnavailable /> }}
            >
              <Suspense fallback={<ProposalSheetSkeleton />}>
                <ProposalSheetBody
                  profileId={shownProfileId}
                  decisionRoot={decisionRootHref(route)}
                />
              </Suspense>
            </APIErrorBoundary>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * The last proposal the sheet was opened on, kept once it closes so the panel
 * animates out with its content still in it instead of emptying first — the
 * same reason `useHostedProposalDialog` holds on to its proposal. Adjusted
 * during render rather than in an effect, so switching proposals never paints
 * the previous one.
 */
function useLastOpenProposal(profileId: string | null): string | null {
  const [shown, setShown] = useState(profileId);

  if (profileId !== null && profileId !== shown) {
    setShown(profileId);
  }

  return shown;
}

function ProposalSheetBody({
  profileId,
  decisionRoot,
}: {
  profileId: string;
  /** Route prefix for sibling proposals, e.g. `/decisions/participatory-budget`. */
  decisionRoot: string;
}) {
  const [proposal] = trpc.decision.getProposal.useSuspenseQuery({ profileId });

  // Same hook the page and the card's metric toggles use, so the three
  // surfaces can't disagree about who may like or follow.
  const engagement = useProposalEngagement({
    proposal,
    canEngage: canEngageWithProposals(proposal.access),
  });
  const commentsEnabled = useCommentsAllowed(proposal.processInstanceId);

  return (
    // Same section rhythm as the proposal page: each section's own `pt` mirrors
    // this gap, so a rule sits centred between the two sections it separates.
    <div className="flex flex-col gap-6 px-4 py-6 sm:gap-10 sm:px-8 sm:py-8">
      {/* No `selection`: the allocated amount and the "Selected" badge it adds
          need the instance's phase list, and the results card behind the sheet
          already carries that badge. The expand control is the way to the
          full record. */}
      <ProposalPreview
        proposal={proposal}
        engagement={toPreviewEngagement(engagement)}
      />

      <ContributingIdeas proposal={proposal} decisionRoot={decisionRoot} />

      {commentsEnabled && (
        <ProposalComments proposal={proposal} decisionRoot={decisionRoot} />
      )}
    </div>
  );
}

/** Header, tag row, author and a few body lines — the shape of what loads. */
function ProposalSheetSkeleton() {
  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <Skeleton className="h-8 w-3/4" />
      <div className="flex gap-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-7 w-32" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="size-8 rounded-full" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <SkeletonText lines={6} />
    </div>
  );
}

/**
 * Anything the proposal query refuses — deleted, hidden from this viewer, or a
 * stale `?proposal=` in a shared link. Kept inside the sheet: the list behind
 * it is still good, so this must not take the page down with it.
 */
function ProposalUnavailable() {
  const t = useTranslations();

  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuTriangleAlert className="size-6" />
        </EmptyMedia>
        <EmptyTitle>{t('decisions.proposals.sheetLoadErrorTitle')}</EmptyTitle>
        <EmptyDescription>
          {t('decisions.proposals.sheetLoadErrorHint')}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
