'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import type { ReviewTranslation } from '@op/common/client';
import { type ReactNode, createContext, useContext, useMemo } from 'react';

import type { ProposalTranslation } from '../ProposalPreview';
import { TranslateBanner } from '../TranslateBanner';
import {
  type RubricTemplateSchema,
  type RubricTranslatedMeta,
  translateRubricTemplate,
} from '../rubricTemplate';
import {
  type ReviewsTarget,
  type RubricTarget,
  useProposalRubricTranslation,
} from '../useProposalRubricTranslation';
import { useReviewForm } from './ReviewFormContext';
import type { PreviousReviewPhase } from './ReviewTabs';

interface ReviewTranslationValue {
  /** Passed straight to `ProposalPreview`; undefined until translated. */
  proposal?: ProposalTranslation;
  /**
   * Rubric copy per phase id. Keyed rather than single because the reviewer's
   * screen can show an earlier phase's rubric in a "Reviews from {phase}" tab.
   */
  rubricMetaByPhase: Record<string, RubricTranslatedMeta>;
  /** Reviewer prose per review id — ids are unique, so no phase key is needed. */
  reviewTranslations: Record<string, ReviewTranslation>;
}

/** Stable identity so consumers outside a provider don't re-render on it. */
const NO_TRANSLATION: ReviewTranslationValue = {
  rubricMetaByPhase: {},
  reviewTranslations: {},
};

const ReviewTranslationContext = createContext<ReviewTranslationValue | null>(
  null,
);

/**
 * Machine translation for the review screen — the proposal in the left pane, the
 * rubric in the right one, and any peer reviews shown beside them, translated
 * together by the single banner this mounts.
 *
 * The panes are siblings under `SplitPane`, so the state lives here rather than
 * in either of them: one "Translate to X" click has to move all of them, and
 * "View original" has to put them all back.
 */
export function ReviewTranslationProvider({
  assignmentId,
  openReviews,
  previousReviewPhases,
  children,
}: {
  assignmentId: string;
  /** Whether this phase's peer reviews are readable — they are a translate target only then. */
  openReviews: boolean;
  previousReviewPhases: PreviousReviewPhase[];
  children: ReactNode;
}) {
  const { assignment, rubricTemplate } = useReviewForm();

  // The same gate `ReviewRubricForm` applies to the tabs themselves: with the
  // flag off no peer review is reachable, so translating one would be paying
  // for copy this screen cannot show.
  const reviewsV2Enabled = useFeatureFlag('reviews-v2') ?? false;

  const previousPhaseIds = useMemo(
    () =>
      reviewsV2Enabled ? previousReviewPhases.map((phase) => phase.id) : [],
    [previousReviewPhases, reviewsV2Enabled],
  );

  /** Phases whose peer reviews this screen can show. */
  const peerPhaseIds = useMemo(
    () => [
      ...(reviewsV2Enabled && openReviews ? [assignment.phaseId] : []),
      ...previousPhaseIds,
    ],
    [assignment.phaseId, openReviews, previousPhaseIds, reviewsV2Enabled],
  );

  const rubricTargets = useMemo<RubricTarget[]>(
    () => [
      { assignmentId, phaseId: assignment.phaseId },
      // An earlier phase scores against its own rubric, which this screen shows
      // above that phase's reviews — addressed by phase, since the reviewer
      // holds no assignment in it.
      ...previousPhaseIds.map((phaseId) => ({
        processInstanceId: assignment.processInstanceId,
        phaseId,
      })),
    ],
    [
      assignmentId,
      assignment.phaseId,
      assignment.processInstanceId,
      previousPhaseIds,
    ],
  );

  const reviewsTargets = useMemo<ReviewsTarget[]>(
    () =>
      peerPhaseIds.map((phaseId) => ({
        processInstanceId: assignment.processInstanceId,
        proposalId: assignment.proposal.id,
        phaseId,
      })),
    [assignment.processInstanceId, assignment.proposal.id, peerPhaseIds],
  );

  const rubricTemplates = useMemo(
    () => ({ [assignment.phaseId]: rubricTemplate }),
    [assignment.phaseId, rubricTemplate],
  );

  const {
    proposal,
    rubricMetaByPhase,
    reviewTranslations,
    showBanner,
    isTranslating,
    targetLanguageName,
    handleTranslate,
    dismissBanner,
  } = useProposalRubricTranslation({
    proposal: assignment.proposal,
    rubricTemplates,
    rubricTargets,
    reviewsTargets,
    // Peer reviews load lazily, once their tab is opened, so this screen has
    // none in hand to detect on — the banner is raised by the proposal and the
    // rubric, and a click then covers the tabs too.
  });

  return (
    <ReviewTranslationScope
      proposal={proposal}
      rubricMetaByPhase={rubricMetaByPhase}
      reviewTranslations={reviewTranslations}
    >
      {children}

      {showBanner && (
        <TranslateBanner
          onTranslate={handleTranslate}
          onDismiss={dismissBanner}
          isTranslating={isTranslating}
          languageName={targetLanguageName}
        />
      )}
    </ReviewTranslationScope>
  );
}

/**
 * Shares a translation the host already holds with the review surfaces below it,
 * without mounting a second banner of its own.
 *
 * The admin review summary owns both the banner and the rubric it translates,
 * and the reviews panel and the reviewer's own form both render inside that
 * screen. Without this they read an empty context and rendered in the authored
 * language while the summary around them stayed translated.
 */
export function ReviewTranslationScope({
  proposal,
  rubricMetaByPhase,
  reviewTranslations,
  children,
}: ReviewTranslationValue & { children: ReactNode }) {
  const value = useMemo<ReviewTranslationValue>(
    () => ({ proposal, rubricMetaByPhase, reviewTranslations }),
    [proposal, rubricMetaByPhase, reviewTranslations],
  );

  return (
    <ReviewTranslationContext.Provider value={value}>
      {children}
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

/**
 * Applies one phase's translated rubric copy to the authored template, for a
 * caller holding the phase-keyed map itself rather than reading it from context
 * (the admin summary, which produces the map).
 */
export function translateRubricForPhase(
  template: RubricTemplateSchema,
  rubricMetaByPhase: Record<string, RubricTranslatedMeta>,
  phaseId: string | null | undefined,
): RubricTemplateSchema {
  return translateRubricTemplate(
    template,
    (phaseId ? rubricMetaByPhase[phaseId] : null) ?? null,
  );
}

/**
 * The rubric to render for a phase: the authored template with this screen's
 * translation applied, or the template itself when nothing is translated.
 *
 * Every rubric surface needs exactly this, so it reads the context and memoizes
 * here rather than each one repeating the lookup and its dep list. Overloaded so
 * a caller with a non-null template keeps a non-null result.
 */
export function useTranslatedRubric(
  template: RubricTemplateSchema,
  phaseId: string | null | undefined,
): RubricTemplateSchema;
export function useTranslatedRubric(
  template: RubricTemplateSchema | null | undefined,
  phaseId: string | null | undefined,
): RubricTemplateSchema | null;
export function useTranslatedRubric(
  template: RubricTemplateSchema | null | undefined,
  phaseId: string | null | undefined,
): RubricTemplateSchema | null {
  const { rubricMetaByPhase } = useReviewTranslation();

  return useMemo(
    () =>
      template
        ? translateRubricForPhase(template, rubricMetaByPhase, phaseId)
        : null,
    [template, rubricMetaByPhase, phaseId],
  );
}
