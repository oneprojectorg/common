'use client';

import {
  OVERALL_RECOMMENDATION_KEY,
  ProposalReviewAssignmentStatus,
  type ProposalWithSubmittedReviews,
  type RubricTemplateSchema,
  type SubmittedReviewItem,
  parseSchemaOptions,
} from '@op/common/client';
import { Alert, AlertDescription, AlertTitle } from '@op/sense/Alert';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import { Header3 } from '@op/sense/Header';
import { StatusDot } from '@op/sense/StatusDot';
import { useMemo, useState } from 'react';
import { LuChevronRight, LuCircleAlert, LuRefreshCcw } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProfileAvatar } from '../../ProfileAvatar';
import {
  type ReminderRecipientPreview,
  SendReminderDialog,
  type SendReminderTarget,
} from '../ReviewAssignments/SendReminderDialog';
import { AverageScoreBar } from './AverageScoreBar';
import type {
  OwnReviewEntry,
  ReminderScope,
  RubricSummary,
} from './ReviewsPanel';
import { recommendationIntent } from './recommendationIntent';

interface ReviewerListProps {
  proposalWithReviews: ProposalWithSubmittedReviews;
  reviews: SubmittedReviewItem[];
  rubricTemplate: RubricTemplateSchema | null;
  rubricSummary: RubricSummary;
  onSelectAssignment: (assignmentId: string) => void;
  hideSummaryHeader?: boolean;
  title?: string;
  ownReview?: OwnReviewEntry;
  reminderScope?: ReminderScope;
}

type PendingReviewer =
  ProposalWithSubmittedReviews['aggregates']['reviewers'][number];

export function ReviewerList({
  proposalWithReviews,
  reviews,
  rubricTemplate,
  rubricSummary,
  onSelectAssignment,
  hideSummaryHeader,
  title,
  ownReview,
  reminderScope,
}: ReviewerListProps) {
  const t = useTranslations();
  const {
    reviewsSubmittedCount,
    assignmentsCount,
    averageScore,
    outOfDateReviewsCount,
    reviewers,
  } = proposalWithReviews.aggregates;
  const { hasScoring, hasOverallRecommendation, totalPoints } = rubricSummary;

  const recommendationOptions = useMemo(
    () =>
      hasOverallRecommendation && rubricTemplate
        ? parseSchemaOptions(
            rubricTemplate.properties?.[OVERALL_RECOMMENDATION_KEY],
          )
        : [],
    [hasOverallRecommendation, rubricTemplate],
  );

  const groups = useMemo(() => {
    if (!hasOverallRecommendation) {
      return null;
    }
    return getReviewsGroupedByRecommendation(reviews, recommendationOptions);
  }, [reviews, hasOverallRecommendation, recommendationOptions]);

  // Other reviewers' revision-flow assignments are left out: they wait on the
  // author or on a re-review, and the panel does not remind them yet. The
  // viewer's own stays in, as its card is their only way back to the form.
  const pendingReviewers = useMemo(
    () =>
      reviewers.filter(
        (reviewer) =>
          reviewer.submittedAt === null &&
          (isAwaitingReview(reviewer) ||
            reviewer.profile.id === ownReview?.profileId),
      ),
    [reviewers, ownReview?.profileId],
  );

  const remindableReviewers = pendingReviewers.filter((reviewer) =>
    isRemindable(reviewer, ownReview?.profileId),
  );

  const [reminderTarget, setReminderTarget] =
    useState<SendReminderTarget | null>(null);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const openReminder = (reviewer: PendingReviewer) => {
    setReminderTarget({ kind: 'one', recipient: toRecipient(reviewer) });
    setIsReminderOpen(true);
  };
  const openReminderForAll = () => {
    setReminderTarget({
      kind: 'reviewers',
      recipients: remindableReviewers.map(toRecipient),
    });
    setIsReminderOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      {!hideSummaryHeader && (
        <header className="flex flex-col gap-2">
          <Header3>
            {title ?? t('decisions.review.reviewSummaryHeading')}
          </Header3>
          <p className="text-base">
            {t('decisions.review.proposalReviewersSubmittedProgress', {
              submitted: reviewsSubmittedCount,
              total: assignmentsCount,
            })}
          </p>
        </header>
      )}

      {/* Admin-only: the reviewer-facing panel hides the summary header. */}
      {!hideSummaryHeader && outOfDateReviewsCount > 0 && (
        <Alert variant="warning">
          <LuRefreshCcw />
          <AlertTitle>
            {t('decisions.review.reviewsOutOfDateCount', {
              n: outOfDateReviewsCount,
              total: reviewsSubmittedCount,
            })}
          </AlertTitle>
          <AlertDescription>
            {t('decisions.review.reviewsOutOfDateExplanation', {
              n: outOfDateReviewsCount,
              total: reviewsSubmittedCount,
            })}
          </AlertDescription>
        </Alert>
      )}

      {hasScoring && reviewsSubmittedCount > 0 && (
        <AverageScoreBar
          averageScore={averageScore}
          totalPoints={totalPoints}
        />
      )}

      {groups ? (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <RecommendationGroup
              key={group.value}
              label={group.label}
              count={group.items.length}
              value={group.value}
            >
              {group.items.map((item) => (
                <ReviewerRow
                  key={item.review.assignmentId}
                  item={item}
                  showScore={hasScoring}
                  totalPoints={totalPoints}
                  onSelect={onSelectAssignment}
                  isOwn={item.reviewer.id === ownReview?.profileId}
                />
              ))}
            </RecommendationGroup>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Header3 className="text-label">
            {t('decisions.review.submittedReviewsStat')}
          </Header3>
          <div className="flex flex-col gap-2">
            {reviews.map((item) => (
              <ReviewerRow
                key={item.review.assignmentId}
                item={item}
                showScore={hasScoring}
                totalPoints={totalPoints}
                onSelect={onSelectAssignment}
                isOwn={item.reviewer.id === ownReview?.profileId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Admin-only, like the summary header. */}
      {!hideSummaryHeader && pendingReviewers.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <StatusDot intent="neutral" className="gap-2">
              <span className="font-serif text-sm">
                {t('decisions.review.notSubmittedYetGroup', {
                  count: pendingReviewers.length,
                })}
              </span>
            </StatusDot>
            {reminderScope && remindableReviewers.length > 1 && (
              <Button
                variant="link"
                size="inline"
                onClick={openReminderForAll}
                className="text-sm"
              >
                {t('decisions.review.remindAllAction')}
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {pendingReviewers.map((reviewer) => (
              <PendingReviewerRow
                key={reviewer.profile.id}
                reviewer={reviewer}
                isOwn={reviewer.profile.id === ownReview?.profileId}
                onRemind={
                  reminderScope && isRemindable(reviewer, ownReview?.profileId)
                    ? openReminder
                    : undefined
                }
                onStartReview={
                  ownReview &&
                  !ownReview.hasSubmitted &&
                  reviewer.profile.id === ownReview.profileId
                    ? ownReview.onOpenForm
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}

      {reminderScope && (
        <SendReminderDialog
          processInstanceId={reminderScope.processInstanceId}
          phaseId={reminderScope.phaseId}
          target={reminderTarget}
          open={isReminderOpen}
          onOpenChange={setIsReminderOpen}
        />
      )}
    </div>
  );
}

interface ReviewerGroup {
  value: string;
  label: string;
  items: SubmittedReviewItem[];
}

function getReviewsGroupedByRecommendation(
  reviews: SubmittedReviewItem[],
  options: ReturnType<typeof parseSchemaOptions>,
): ReviewerGroup[] {
  const order = options.map((o) => String(o.value));
  const titles = new Map(options.map((o) => [String(o.value), o.title]));

  const buckets = new Map<string, SubmittedReviewItem[]>();
  for (const value of order) {
    buckets.set(value, []);
  }

  for (const review of reviews) {
    const value = review.overallRecommendation ?? '';
    if (!value) continue;
    const bucket = buckets.get(value) ?? [];
    bucket.push(review);
    buckets.set(value, bucket);
  }

  return Array.from(buckets.entries())
    .filter(([, items]) => items.length > 0)
    .map(([value, items]) => ({
      value,
      label: titles.get(value) ?? value,
      items,
    }));
}

function RecommendationGroup({
  label,
  count,
  value,
  children,
}: {
  label: string;
  count: number;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <StatusDot intent={recommendationIntent(value)} className="gap-2">
        <span className="font-serif text-sm">
          {label} ({count})
        </span>
      </StatusDot>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function ReviewerRow({
  item,
  showScore,
  totalPoints,
  onSelect,
  isOwn,
}: {
  item: SubmittedReviewItem;
  showScore: boolean;
  totalPoints: number;
  onSelect: (assignmentId: string) => void;
  isOwn?: boolean;
}) {
  const t = useTranslations();
  const reviewerName = item.reviewer.name ?? item.reviewer.slug;
  const rowLabel = isOwn
    ? t('decisions.review.reviewerNameYou', { name: reviewerName })
    : reviewerName;

  return (
    // `bare`: the row keeps its card look and picks up the sense focus ring,
    // which the hand-rolled outline it used to carry never matched.
    <Button
      variant="bare"
      onClick={() => onSelect(item.review.assignmentId)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background p-4 text-start transition-colors duration-200 hover:bg-muted"
      // aria-label replaces the row's visible text, so it must repeat the tag.
      aria-label={
        item.isReviewOutOfDate
          ? t('decisions.review.viewOlderReviewByName', { name: rowLabel })
          : t('decisions.review.viewReviewByName', { name: rowLabel })
      }
    >
      <div className="flex items-center gap-3">
        <ProfileAvatar
          profile={item.reviewer}
          withLink={false}
          className="size-10"
        />
        <div className="flex flex-col">
          <span className="text-base">{rowLabel}</span>
          {showScore && (
            <span className="text-sm">
              {item.score}
              <span className="text-muted-foreground">/{totalPoints}pts</span>
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {item.isReviewOutOfDate && (
          <Badge variant="warning">
            <LuCircleAlert aria-hidden className="text-warning" />
            {t('decisions.review.olderVersionLabel')}
          </Badge>
        )}
        <LuChevronRight className="size-4 text-muted-foreground rtl:-scale-x-100" />
      </div>
    </Button>
  );
}

function PendingReviewerRow({
  reviewer,
  isOwn,
  onRemind,
  onStartReview,
}: {
  reviewer: PendingReviewer;
  isOwn: boolean;
  onRemind?: (reviewer: PendingReviewer) => void;
  onStartReview?: () => void;
}) {
  const t = useTranslations();
  const reviewerName = reviewer.profile.name ?? reviewer.profile.slug;
  const rowLabel = isOwn
    ? t('decisions.review.reviewerNameYou', { name: reviewerName })
    : reviewerName;

  return (
    <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background p-4">
      <div className="flex min-w-0 items-center gap-3">
        <ProfileAvatar
          profile={reviewer.profile}
          withLink={false}
          className="size-10"
        />
        <div className="flex min-w-0 flex-col">
          <span className="text-base">
            <bdi>{rowLabel}</bdi>
          </span>
          <span className="text-sm text-muted-foreground">
            {t(getPendingStatusLabel(reviewer.status))}
          </span>
        </div>
      </div>
      {onRemind && (
        <Button
          variant="outline"
          aria-label={t('decisions.review.remindReviewerLabel', {
            name: reviewerName,
          })}
          onClick={() => onRemind(reviewer)}
        >
          {t('decisions.review.remindAction')}
        </Button>
      )}
      {onStartReview && (
        <Button variant="outline" onClick={onStartReview}>
          {t('decisions.review.addReviewAction')}
        </Button>
      )}
    </div>
  );
}

function getPendingStatusLabel(status: PendingReviewer['status']) {
  switch (status) {
    case ProposalReviewAssignmentStatus.PENDING:
      return 'decisions.review.statusNotStarted';
    case ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION:
      return 'decisions.review.statusRevisionRequested';
    case ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW:
      return 'decisions.review.statusNeedsReview';
    default:
      return 'decisions.review.statusInProgress';
  }
}

function isAwaitingReview(reviewer: PendingReviewer): boolean {
  return (
    reviewer.status === ProposalReviewAssignmentStatus.PENDING ||
    reviewer.status === ProposalReviewAssignmentStatus.IN_PROGRESS
  );
}

function isRemindable(
  reviewer: PendingReviewer,
  ownProfileId: string | undefined,
): boolean {
  return reviewer.profile.id !== ownProfileId;
}

function toRecipient(reviewer: PendingReviewer): ReminderRecipientPreview {
  return {
    id: reviewer.profile.id,
    name: reviewer.profile.name ?? reviewer.profile.slug,
    contact: null,
    remainingCount: null,
  };
}
