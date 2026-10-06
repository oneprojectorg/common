import {
  ReviewLayout,
  type ReviewLayoutProps,
} from '@/components/decisions/Review/ReviewLayout';
import {
  ReviewSummaryLayout,
  type ReviewSummaryLayoutProps,
} from '@/components/decisions/ReviewSummary/ReviewSummaryLayout';

/**
 * The proposal-keyed reviews URL renders a different screen per viewer: the
 * admin "Review Progress" summary, or the reviewer's own review. The server
 * (`loadProposalReviews`) picks the branch.
 */
export type ProposalReviewsView =
  | { kind: 'summary'; summary: ReviewSummaryLayoutProps }
  | { kind: 'review'; review: ReviewLayoutProps };

export function ProposalReviewsLayout({ view }: { view: ProposalReviewsView }) {
  return view.kind === 'summary' ? (
    <ReviewSummaryLayout {...view.summary} />
  ) : (
    <ReviewLayout {...view.review} />
  );
}
