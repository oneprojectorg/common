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
import { Header2, Header3 } from '@op/sense/Header';
import { Sheet, SheetContent, SheetFooter, SheetTitle } from '@op/sense/Sheet';
import { Skeleton } from '@op/sense/Skeleton';
import { type ReactNode, Suspense, useId, useState } from 'react';
import { LuMaximize2, LuUsers, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '../../ButtonLink';
import {
  ProposalSheetContext,
  type ProposalSheetRoute,
} from '../ProposalSheet/proposalSheetState';
import { useLastOpenId } from '../useLastOpenId';
import { ManageAssignmentsAction } from './ManageAssignmentsAction';
import { ReviewerAssignmentList } from './ReviewerAssignmentList';
import {
  AssignmentsNextPage,
  ReviewerActions,
  ReviewerNoAssignments,
  ReviewerNotFound,
  ReviewerStats,
} from './ReviewerAssignmentsParts';
import { accountContactText } from './accountContactText';
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
        className="w-full gap-0 p-0 sm:max-w-148"
      >
        {/* The reviewer's name arrives with the query, so the dialog needs a static name. */}
        <SheetTitle className="sr-only">
          {t('decisions.review.reviewerPanelLabel')}
        </SheetTitle>

        <div className="flex shrink-0 items-center justify-end gap-1 px-4 pt-4">
          {shownId ? (
            <ButtonLink
              href={pageHref(shownId)}
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              aria-label={t('decisions.review.openReviewerPageAction')}
            >
              <LuMaximize2 className="size-4" />
            </ButtonLink>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label={t('Close')}
          >
            <LuX className="size-4" />
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
                    <ReviewerSheetSkeleton />
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
  const headingId = useId();
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
  const contact = accountContactText(reviewer.contact);
  const hasAssignments = summary.total > 0 || summary.remainingCount > 0;

  return (
    <>
      <ScrollRegion ref={setScrollRoot}>
        <div className="flex flex-col gap-2">
          <Header2 className="font-normal">{name}</Header2>
          {contact ? (
            <p className="text-base break-words text-muted-foreground">
              <bdi>{contact}</bdi>
            </p>
          ) : null}
        </div>

        {/* `total` drops merged-away proposals; the counts still hold their reviews. */}
        {summary.assignedCount > 0 ? (
          <ReviewerStats reviewer={summary} className="mt-6" />
        ) : null}

        <div className="mt-10 flex flex-col gap-4">
          <Header3 id={headingId}>
            {t('decisions.review.assignedProposalsHeading', {
              count: summary.total,
            })}
          </Header3>
          {summary.total === 0 ? (
            // The design's compact empty state: no side padding, smaller copy.
            <ReviewerNoAssignments
              input={input}
              name={name}
              className="gap-4 px-0 pt-0 pb-2 **:data-[slot=empty-description]:text-sm **:data-[slot=empty-title]:text-title **:data-[slot=empty-title]:font-normal"
            />
          ) : (
            <>
              <ReviewerAssignmentList
                assignments={assignments}
                route={route}
                labelledBy={headingId}
              />
              <AssignmentsNextPage
                pagination={pagination}
                scrollRoot={scrollRoot}
              />
            </>
          )}
        </div>
      </ScrollRegion>

      <SheetFooter className="shrink-0 flex-row items-center justify-between gap-4 px-6 py-5">
        <p className="text-base whitespace-nowrap tabular-nums">
          {hasAssignments
            ? t('decisions.review.reviewsSubmittedStatus', {
                submitted: summary.submittedCount,
                assigned: summary.assignedCount,
              })
            : t('decisions.review.nothingAssignedStatus')}
        </p>
        {hasAssignments ? (
          <ReviewerActions
            input={input}
            summary={summary}
            reviewer={reviewer}
            name={name}
          />
        ) : (
          <ManageAssignmentsAction {...input} intent="assign" />
        )}
      </SheetFooter>
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
      <div className="flex flex-col px-6 pt-6 pb-8">{children}</div>
    </div>
  );
}

/** Mirrors the panel: name, contact, two stat rows, the heading and the cards. */
function ReviewerSheetSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-6 w-64" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
      <div className="mt-10 flex flex-col gap-4">
        <Skeleton className="h-7 w-56" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-19 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </>
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
