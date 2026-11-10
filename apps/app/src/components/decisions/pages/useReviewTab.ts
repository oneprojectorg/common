'use client';

import { parseAsStringLiteral, useQueryState } from 'nuqs';

// The admin-without-review variant reuses DEFAULT_REVIEW_TAB for its progress
// list, so one parser covers every `?tab=` value.
const REVIEW_TABS = ['to-review', 'all-proposals', 'reviewers'] as const;
export const DEFAULT_REVIEW_TAB = 'to-review';

const reviewTabParser = parseAsStringLiteral(REVIEW_TABS);

/**
 * The review page's active tab, shared with the decision router so both agree
 * on whether All proposals is showing.
 */
export function useReviewTab({
  isAdmin,
  canReview,
}: {
  isAdmin: boolean;
  canReview: boolean;
}) {
  // In the URL so a reload or shared link lands on the same tab.
  const [tab, setTab] = useQueryState(
    'tab',
    reviewTabParser.withDefault(DEFAULT_REVIEW_TAB),
  );

  const activeTab = tab === 'reviewers' && !isAdmin ? DEFAULT_REVIEW_TAB : tab;

  // The admin variant shows All proposals under DEFAULT_REVIEW_TAB.
  const adminActiveTab =
    activeTab === 'reviewers' ? 'reviewers' : DEFAULT_REVIEW_TAB;

  const showsAllProposals = canReview
    ? activeTab === 'all-proposals'
    : isAdmin && adminActiveTab === DEFAULT_REVIEW_TAB;

  const handleTabChange = (next: string) => {
    const parsed = reviewTabParser.parse(next);

    if (!parsed) {
      return;
    }

    // Strip the param on the default tab so the URL stays clean.
    void setTab(parsed === DEFAULT_REVIEW_TAB ? null : parsed);
  };

  return { activeTab, adminActiveTab, showsAllProposals, handleTabChange };
}
