'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { Button } from '@op/sense/Button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Sheet, SheetContent, SheetFooter, SheetTitle } from '@op/sense/Sheet';
import { type ReactNode, Suspense, useState } from 'react';
import { LuExpand, LuUsers, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '../../ButtonLink';
import {
  ProposalSheetContext,
  type ProposalSheetRoute,
} from '../ProposalSheet/proposalSheetState';
import { useLastOpenId } from '../useLastOpenId';
import {
  ReviewerActions,
  ReviewerAssignmentsBody,
  ReviewerNotFound,
} from './ReviewerAssignmentsBody';
import {
  ReviewerAssignmentsBodySkeleton,
  ReviewerHeaderSkeleton,
} from './ReviewAssignmentsSkeletons';
import { ReviewerHeader } from './ReviewerHeader';
import {
  type ReviewerAssignmentsInput,
  getReviewerName,
  useReviewerAssignments,
} from './useReviewerAssignments';

/** Not `reviewer`, so it cannot collide with a filter param. */
export const REVIEWER_PANEL_PARAM = 'reviewerPanel';

interface ReviewerSheetProps {
  processInstanceId: string;
  phaseId: string;
  route: ProposalSheetRoute;
  /** The reviewer shown, or null when the panel is closed. */
  reviewerProfileId: string | null;
  /** The reviewer page that the expand button opens. */
  pageHref: (reviewerProfileId: string) => string;
  onClose: () => void;
}

/** One reviewer's progress beside the Reviewers list, with the reviewer page one click away. */
export function ReviewerSheet({
  processInstanceId,
  phaseId,
  route,
  reviewerProfileId,
  pageHref,
  onClose,
}: ReviewerSheetProps) {
  const t = useTranslations();
  const shownId = useLastOpenId(reviewerProfileId);

  return (
    <Sheet
      open={reviewerProfileId !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <SheetContent
        side="inline-end"
        // sense labels its built-in close "Close" in English.
        showCloseButton={false}
        className="w-full gap-0 p-0 sm:max-w-2xl"
      >
        {/* The reviewer's name arrives with the query, so the dialog needs a static name. */}
        <SheetTitle className="sr-only">
          {t('decisions.review.reviewerPanelLabel')}
        </SheetTitle>

        <div className="flex shrink-0 items-center justify-end gap-1 border-b px-4 py-3">
          {shownId ? (
            <ButtonLink
              href={pageHref(shownId)}
              variant="ghost"
              size="icon-sm"
              aria-label={t('decisions.review.openReviewerPageAction')}
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

        {/* Panels never stack: without sheet controls, a proposal opens its full
            reviews page, and Back returns to this panel. */}
        {shownId ? (
          <ProposalSheetContext.Provider value={null}>
            <APIErrorBoundary
              key={shownId}
              fallbacks={{
                default: () => (
                  <ScrollRegion>
                    <ReviewerUnavailable />
                  </ScrollRegion>
                ),
              }}
            >
              <Suspense
                fallback={
                  <ScrollRegion>
                    <ReviewerHeaderSkeleton />
                    <ReviewerAssignmentsBodySkeleton />
                  </ScrollRegion>
                }
              >
                <ReviewerSheetContent
                  input={{
                    processInstanceId,
                    phaseId,
                    reviewerProfileId: shownId,
                  }}
                  route={route}
                />
              </Suspense>
            </APIErrorBoundary>
          </ProposalSheetContext.Provider>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ReviewerSheetContent({
  input,
  route,
}: {
  input: ReviewerAssignmentsInput;
  route: ProposalSheetRoute;
}) {
  const t = useTranslations();
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const { summary, assignments, pagination } = useReviewerAssignments(input);

  if (!summary?.reviewer) {
    return (
      <ScrollRegion>
        <ReviewerNotFound />
      </ScrollRegion>
    );
  }

  const { reviewer } = summary;
  const name = getReviewerName(reviewer);

  return (
    <>
      <ScrollRegion ref={setScrollRoot}>
        <ReviewerHeader name={name} contact={reviewer.contact} />
        <ReviewerAssignmentsBody
          input={input}
          summary={summary}
          name={name}
          assignments={assignments}
          pagination={pagination}
          route={route}
          scrollRoot={scrollRoot}
        />
      </ScrollRegion>

      {summary.total > 0 || summary.remainingCount > 0 ? (
        <SheetFooter className="shrink-0 flex-row flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <p className="text-sm text-muted-foreground tabular-nums">
            {t('decisions.review.reviewsSubmittedStatus', {
              submitted: summary.submittedCount,
              assigned: summary.assignedCount,
            })}
          </p>
          <ReviewerActions
            input={input}
            summary={summary}
            reviewer={reviewer}
            name={name}
          />
        </SheetFooter>
      ) : null}
    </>
  );
}

function ScrollRegion({
  ref,
  children,
}: {
  ref?: (node: HTMLDivElement | null) => void;
  children: ReactNode;
}) {
  return (
    <div ref={ref} className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
        {children}
      </div>
    </div>
  );
}

function ReviewerUnavailable() {
  const t = useTranslations();

  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuUsers className="size-6" />
        </EmptyMedia>
        <EmptyTitle>{t('decisions.review.loadAssignmentsError')}</EmptyTitle>
        <EmptyDescription>
          {t('decisions.proposals.refreshPageHint')}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
