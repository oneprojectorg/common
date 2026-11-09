'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { Button } from '@op/sense/Button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Sheet, SheetContent, SheetTitle } from '@op/sense/Sheet';
import { Skeleton, SkeletonText } from '@op/sense/Skeleton';
import { type ReactNode, Suspense, useContext, useState } from 'react';
import { LuExpand, LuTriangleAlert, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '../../ButtonLink';
import { ProposalProvider } from '../Proposal/proposalContext';
import { ReportProposalDialog } from '../ReportProposalDialog';
import { decisionRootHref, proposalHref } from '../proposalHrefs';
import { useLiveProposalDocument } from '../useLiveProposalDocument';
import { ProposalSheetStateContext } from './proposalSheetState';

/**
 * The sheet's chrome: the sense `Sheet`, the header actions, the error boundary
 * and Suspense, the scroll region, and the proposal context the parts inside
 * read. Renders nothing without a `ProposalSheetProvider` above, or on a phone.
 */
export function ProposalSheetShell({
  footer,
  children,
}: {
  /**
   * Stays in view under the scroll region, e.g. a `ProposalSheetFooter`.
   * Renders only once the proposal has loaded, inside its context.
   */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations();
  const state = useContext(ProposalSheetStateContext);
  const shownProfileId = useLastOpenProposal(state?.openProfileId ?? null);

  if (!state) {
    return null;
  }

  return (
    <Sheet
      open={state.openProfileId !== null}
      onOpenChange={(open) => {
        if (!open) {
          state.close();
        }
      }}
    >
      <SheetContent
        side="inline-end"
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
              {/* Reporting needs the proposal's own id, so it waits on the
                  query. Close stays up throughout. */}
              <APIErrorBoundary fallbacks={{ default: () => null }}>
                <Suspense fallback={null}>
                  <ReportAction profileId={shownProfileId} />
                </Suspense>
              </APIErrorBoundary>
              <ButtonLink
                href={
                  state.expandHref
                    ? state.expandHref(shownProfileId)
                    : proposalHref({
                        ...state.route,
                        profileId: shownProfileId,
                      })
                }
                variant="ghost"
                size="icon-sm"
                aria-label={t('decisions.proposals.openFullProposalAction')}
              >
                <LuExpand className="size-4" />
              </ButtonLink>
            </>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={state.close}
            aria-label={t('Close')}
          >
            <LuX className="size-5" />
          </Button>
        </div>

        {/* Keyed so a failure doesn't latch onto the next proposal opened. */}
        {shownProfileId ? (
          <APIErrorBoundary
            key={shownProfileId}
            fallbacks={{
              default: () => (
                <ScrollRegion>
                  <ProposalUnavailable />
                </ScrollRegion>
              ),
            }}
          >
            <Suspense
              fallback={
                <ScrollRegion>
                  <ProposalSheetSkeleton />
                </ScrollRegion>
              }
            >
              <SheetProposalProvider
                profileId={shownProfileId}
                decisionRoot={decisionRootHref(state.route)}
              >
                <ScrollRegion>
                  <div className="px-4 py-6 sm:px-8 sm:py-8">{children}</div>
                </ScrollRegion>
                {footer}
              </SheetProposalProvider>
            </Suspense>
          </APIErrorBoundary>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/** The one `getProposal` read for the parts; they take the proposal from context. */
function SheetProposalProvider({
  profileId,
  decisionRoot,
  children,
}: {
  profileId: string;
  decisionRoot: string;
  children: ReactNode;
}) {
  const [initialProposal] = trpc.decision.getProposal.useSuspenseQuery({
    profileId,
  });
  const { proposal, documentState } = useLiveProposalDocument(initialProposal);

  return (
    <ProposalProvider
      proposal={proposal}
      decisionRoot={decisionRoot}
      documentState={documentState}
    >
      {children}
    </ProposalProvider>
  );
}

/** Shares the body's query, so it costs no extra request. */
function ReportAction({ profileId }: { profileId: string }) {
  const [proposal] = trpc.decision.getProposal.useSuspenseQuery({ profileId });

  return <ReportProposalDialog proposalId={proposal.id} iconOnly />;
}

function ScrollRegion({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>;
}

/** Held past the close so the panel animates out with its content still in it. */
function useLastOpenProposal(profileId: string | null): string | null {
  const [shown, setShown] = useState(profileId);

  if (profileId !== null && profileId !== shown) {
    setShown(profileId);
  }

  return shown;
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
