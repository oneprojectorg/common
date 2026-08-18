'use client';

import { type ReactNode, createContext, useContext, useMemo } from 'react';

import type { ProposalTranslation } from '../ProposalPreview';
import { TranslateBanner } from '../TranslateBanner';
import type { RubricTranslatedMeta } from '../rubricTemplate';
import { useProposalRubricTranslation } from '../useProposalRubricTranslation';
import { useReviewForm } from './ReviewFormContext';

interface ReviewTranslationValue {
  /** Passed straight to `ProposalPreview`; undefined until translated. */
  proposal?: ProposalTranslation;
  /** Applied to the rubric template; null until translated. */
  rubricMeta: RubricTranslatedMeta | null;
}

/** Stable identity so consumers outside a provider don't re-render on it. */
const NO_TRANSLATION: ReviewTranslationValue = { rubricMeta: null };

const ReviewTranslationContext = createContext<ReviewTranslationValue | null>(
  null,
);

/**
 * Machine translation for the review screen — the proposal in the left pane and
 * the rubric in the right one, translated together by the single banner this
 * mounts.
 *
 * The two panes are siblings under `SplitPane`, so the state lives here rather
 * than in either of them: one "Translate to X" click has to move both, and
 * "View original" has to put both back.
 */
export function ReviewTranslationProvider({
  assignmentId,
  children,
}: {
  assignmentId: string;
  children: ReactNode;
}) {
  const { assignment, rubricTemplate } = useReviewForm();

  const {
    proposal,
    rubricMeta,
    showBanner,
    isTranslating,
    targetLanguageName,
    handleTranslate,
    dismissBanner,
  } = useProposalRubricTranslation({
    proposal: assignment.proposal,
    rubricTemplate,
    rubricTarget: { assignmentId },
  });

  const value = useMemo<ReviewTranslationValue>(
    () => ({ proposal, rubricMeta }),
    [proposal, rubricMeta],
  );

  return (
    <ReviewTranslationContext.Provider value={value}>
      {children}

      {showBanner && (
        <TranslateBanner
          onTranslate={handleTranslate}
          onDismiss={dismissBanner}
          isTranslating={isTranslating}
          languageName={targetLanguageName}
        />
      )}
    </ReviewTranslationContext.Provider>
  );
}

/**
 * Translated review copy, or empty values when no provider is mounted (the
 * review form also renders inside the admin drill-in and the proposal-keyed
 * review routes) or nothing has been translated yet.
 */
export function useReviewTranslation(): ReviewTranslationValue {
  return useContext(ReviewTranslationContext) ?? NO_TRANSLATION;
}
