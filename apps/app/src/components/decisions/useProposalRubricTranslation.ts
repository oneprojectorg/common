'use client';

import { useAnyContentNeedsTranslation } from '@/hooks/useAnyContentNeedsTranslation';
import { trpc } from '@op/api/client';
import {
  type ReviewTranslation,
  type RubricTemplateSchema,
  SUPPORTED_LOCALES,
  type SubmittedReviewItem,
  type SupportedLocale,
  type TranslatedFields,
  parseTranslatedMeta,
} from '@op/common/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useLocale } from 'next-intl';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import type { ProposalTranslation } from './ProposalPreview';
import type { RubricTranslatedMeta } from './rubricTemplate';
import {
  getProposalDetectionText,
  getReviewsDetectionText,
  getRubricDetectionText,
} from './translationDetectionText';

/**
 * Stable empty map for the untranslated case: this value ends up in a context,
 * so a fresh `{}` per render would re-render every review surface below it.
 */
const NO_REVIEW_TRANSLATIONS: Record<string, ReviewTranslation> = {};

/** The proposal fields this needs: enough to detect, plus the translate target. */
type TranslatableProposal = Parameters<typeof getProposalDetectionText>[0] & {
  profileId: string;
};

/**
 * How a rubric is addressed: by assignment on the reviewer's screen, by phase
 * on the admin summary and on any screen showing a phase it holds no assignment
 * in. Both reach the same phase-keyed cache.
 *
 * `phaseId` rides along on both because the results are handed back keyed by
 * phase — one screen can show more than one phase's rubric.
 */
export type RubricTarget = { phaseId: string } & (
  | { assignmentId: string }
  | { processInstanceId: string }
);

/** One phase's submitted reviews, addressed as `getProposalWithReviewAggregates` does. */
export interface ReviewsTarget {
  processInstanceId: string;
  proposalId: string;
  /** Omitted only by an admin screen reading the instance's current phase. */
  phaseId?: string;
}

export interface ProposalRubricTranslation {
  /** Passed straight to `ProposalPreview`; undefined until translated. */
  proposal?: ProposalTranslation;
  /** Rubric copy per phase id, applied with `translateRubricTemplate`. */
  rubricMetaByPhase: Record<string, RubricTranslatedMeta>;
  /** Reviewer prose per review id — review ids are unique across phases. */
  reviewTranslations: Record<string, ReviewTranslation>;
  showBanner: boolean;
  isTranslating: boolean;
  targetLanguageName: string;
  handleTranslate: () => void;
  dismissBanner: () => void;
}

/**
 * Machine translation for a screen showing one proposal beside the rubric it is
 * scored with and the reviews written against it — the reviewer's form and the
 * admin's review summary both do.
 *
 * Shared rather than reimplemented per screen: the panes have to move on a
 * single click and revert together, and the in-flight guards below are easy to
 * get subtly wrong. Every surface reads the same rubric, so every surface offers
 * the same control.
 *
 * Everything is addressed in lists so one click covers a screen that shows more
 * than one phase (the reviewer's "Reviews from {phase}" tabs). Pass empty lists
 * for a surface that has nothing of that kind — detection then skips it, so the
 * control is never raised by copy this cannot move.
 */
export const useProposalRubricTranslation = ({
  proposal,
  rubricTemplates,
  rubricTargets,
  reviewsTargets = [],
  reviews = [],
}: {
  proposal: TranslatableProposal;
  /** Rubrics on screen, keyed by phase — the detection input for `rubricTargets`. */
  rubricTemplates?: Record<string, RubricTemplateSchema | null>;
  rubricTargets: RubricTarget[];
  reviewsTargets?: ReviewsTarget[];
  /** Reviews already loaded, for detection; the targets above decide what is translated. */
  reviews?: readonly SubmittedReviewItem[];
}): ProposalRubricTranslation => {
  const t = useTranslations();
  const locale = useLocale();

  const supportedLocale = (SUPPORTED_LOCALES as readonly string[]).includes(
    locale,
  )
    ? (locale as SupportedLocale)
    : null;

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translated, setTranslated] = useState<{
    proposal?: TranslatedFields;
    rubricByPhase: Record<string, TranslatedFields>;
    reviews: Record<string, ReviewTranslation>;
    sourceLocale: string;
  } | null>(null);

  // Flipped true on Translate, false on View Original. A response that lands
  // after the reader reverts checks this before writing state, so the revert
  // can't be undone by an in-flight request (as in useTranslateDecision).
  const translatingRef = useRef(false);

  const translateProposalMutation =
    trpc.translation.translateProposal.useMutation();
  const translateRubricMutation =
    trpc.translation.translateRubric.useMutation();
  const translatePhaseRubricMutation =
    trpc.translation.translatePhaseRubric.useMutation();
  const translateReviewsMutation =
    trpc.translation.translateReviews.useMutation();

  // One sample per surface rather than one concatenated blob: a rubric authored
  // in Spanish must offer translation even when the proposal is in English, and
  // reviews written in Spanish must offer it even when both of those are
  // English — that last one is the whole point of the admin summary.
  const samples = useMemo(
    () => [
      getProposalDetectionText(proposal),
      ...rubricTargets.map((target) =>
        getRubricDetectionText(rubricTemplates?.[target.phaseId]),
      ),
      reviewsTargets.length > 0
        ? getReviewsDetectionText(
            reviews,
            // Reviews are scored against the rubric of the phase they belong
            // to; a screen with reviews always has that phase's rubric.
            rubricTemplates?.[reviewsTargets[0]?.phaseId ?? ''] ?? null,
          )
        : '',
    ],
    [proposal, rubricTemplates, rubricTargets, reviewsTargets, reviews],
  );
  const needsTranslation = useAnyContentNeedsTranslation(samples);

  const handleTranslate = useCallback(() => {
    if (!supportedLocale) {
      return;
    }

    translatingRef.current = true;
    setIsTranslating(true);

    // One banner drives every request, so they succeed or fail as one: a
    // failure discards whatever the others returned. Keeping a partial result
    // would hide the banner — the only retry control — with one pane still
    // untranslated, and a rubric-only success renders no "View original"
    // either, stranding the screen until a reload.
    void (async () => {
      try {
        const [proposalResult, rubricResults, reviewsResults] =
          await Promise.all([
            translateProposalMutation.mutateAsync({
              profileId: proposal.profileId,
              targetLocale: supportedLocale,
            }),
            Promise.all(
              rubricTargets.map(async (target) => ({
                phaseId: target.phaseId,
                result:
                  'assignmentId' in target
                    ? await translateRubricMutation.mutateAsync({
                        assignmentId: target.assignmentId,
                        targetLocale: supportedLocale,
                      })
                    : await translatePhaseRubricMutation.mutateAsync({
                        processInstanceId: target.processInstanceId,
                        phaseId: target.phaseId,
                        targetLocale: supportedLocale,
                      }),
              })),
            ),
            Promise.all(
              reviewsTargets.map((target) =>
                translateReviewsMutation.mutateAsync({
                  ...target,
                  targetLocale: supportedLocale,
                }),
              ),
            ),
          ]);

        // The reader hit "View original" while this was in flight.
        if (!translatingRef.current) {
          return;
        }

        setTranslated({
          proposal: proposalResult.translated,
          rubricByPhase: Object.fromEntries(
            rubricResults.map(({ phaseId, result }) => [
              phaseId,
              result.translated,
            ]),
          ),
          // Merged into one map: review ids are unique, so a screen showing
          // several phases can look a review up without knowing its phase.
          reviews: reviewsResults.reduce<Record<string, ReviewTranslation>>(
            (merged, result) => ({ ...merged, ...result.translations }),
            {},
          ),
          sourceLocale:
            [
              proposalResult.sourceLocale,
              ...rubricResults.map(({ result }) => result.sourceLocale),
              ...reviewsResults.map((result) => result.sourceLocale),
            ].find(Boolean) ?? '',
        });
      } catch (error) {
        translatingRef.current = false;
        setTranslated(null);
        logger.error('Failed to translate a proposal review screen', { error });
        toast.error(t('Failed to translate content'));
      } finally {
        setIsTranslating(false);
      }
    })();
  }, [
    proposal.profileId,
    reviewsTargets,
    rubricTargets,
    supportedLocale,
    t,
    translateProposalMutation,
    translatePhaseRubricMutation,
    translateReviewsMutation,
    translateRubricMutation,
  ]);

  const handleViewOriginal = useCallback(() => {
    translatingRef.current = false;
    setTranslated(null);
  }, []);

  const languageNames = useMemo(
    () => new Intl.DisplayNames([locale], { type: 'language' }),
    [locale],
  );
  const sourceLanguageName = translated
    ? (languageNames.of(
        translated.sourceLocale.toLowerCase().split('-')[0] ?? '',
      ) ?? '')
    : '';

  const rubricMetaByPhase = useMemo(() => {
    const byPhase: Record<string, RubricTranslatedMeta> = {};
    for (const [phaseId, fields] of Object.entries(
      translated?.rubricByPhase ?? {},
    )) {
      byPhase[phaseId] = parseTranslatedMeta(fields);
    }
    return byPhase;
  }, [translated]);

  return {
    proposal: translated?.proposal
      ? {
          htmlContent: translated.proposal,
          sourceLanguageName,
          onViewOriginal: handleViewOriginal,
        }
      : undefined,
    rubricMetaByPhase,
    reviewTranslations: translated?.reviews ?? NO_REVIEW_TRANSLATIONS,
    showBanner:
      !!supportedLocale && needsTranslation && !bannerDismissed && !translated,
    isTranslating,
    targetLanguageName: languageNames.of(locale) ?? locale,
    handleTranslate,
    dismissBanner: () => setBannerDismissed(true),
  };
};
