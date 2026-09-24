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
import { ReportProposalDialog } from './ReportProposalDialog';
import {
  type ProposalRoute,
  decisionRootHref,
  proposalHref,
} from './proposalHrefs';
import { useCommentsAllowed } from './useCommentsAllowed';
import { useLiveProposalDocument } from './useLiveProposalDocument';

export type ProposalSheetRoute = Omit<ProposalRoute, 'profileId'>;

/**
 * A proposal read in a panel over the page it was opened from, so the list's
 * filters, scroll position and map viewport survive the read.
 */
export function ProposalSheet({
  profileId,
  route,
  onClose,
}: {
  /** `null` keeps the sheet closed. */
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
        // sense labels its built-in close "Close" in English.
        showCloseButton={false}
        className="w-full gap-0 p-0 sm:max-w-2xl"
      >
        {/* The proposal's own H1 arrives with the query, so the dialog's
            accessible name is this static one. */}
        <SheetTitle className="sr-only">
          {t('decisions.proposals.proposalLabel')}
        </SheetTitle>

        <div className="flex shrink-0 items-center justify-end gap-1 border-b px-4 py-3">
          {shownProfileId ? (
            <>
              <ButtonLink
                href={proposalHref({ ...route, profileId: shownProfileId })}
                variant="ghost"
                size="icon-sm"
                aria-label={t('decisions.proposals.openFullProposalAction')}
              >
                <LuExpand className="size-4" />
              </ButtonLink>
              {/* Reporting needs the proposal's own id, so it waits on the
                  query. Close stays up throughout. */}
              <APIErrorBoundary fallbacks={{ default: () => null }}>
                <Suspense fallback={null}>
                  <ReportAction profileId={shownProfileId} />
                </Suspense>
              </APIErrorBoundary>
            </>
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
          {/* Keyed so a failure doesn't latch onto the next proposal opened. */}
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

/** Shares the body's query, so it costs no extra request. */
function ReportAction({ profileId }: { profileId: string }) {
  const [proposal] = trpc.decision.getProposal.useSuspenseQuery({ profileId });

  return <ReportProposalDialog proposalId={proposal.id} iconOnly />;
}

/** Held past the close so the panel animates out with its content still in it. */
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
  const [initialProposal] = trpc.decision.getProposal.useSuspenseQuery({
    profileId,
  });

  const { proposal, documentState } = useLiveProposalDocument(initialProposal);

  const engagement = useProposalEngagement({
    proposal,
    canEngage: canEngageWithProposals(proposal.access),
  });
  const commentsEnabled = useCommentsAllowed(proposal.processInstanceId);

  return (
    // Each section's own `pt` mirrors this gap, centring the rules between.
    <div className="flex flex-col gap-6 px-4 py-6 sm:gap-10 sm:px-8 sm:py-8">
      <ProposalPreview
        proposal={proposal}
        documentState={documentState}
        engagement={toPreviewEngagement(engagement)}
      />

      <ContributingIdeas proposal={proposal} decisionRoot={decisionRoot} />

      {commentsEnabled && (
        <ProposalComments proposal={proposal} decisionRoot={decisionRoot} />
      )}
    </div>
  );
}

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
