'use client';

import { useAnyContentNeedsTranslation } from '@/hooks/useAnyContentNeedsTranslation';
import { trpc } from '@op/api/client';
import {
  SUPPORTED_LOCALES,
  type SupportedLocale,
  type TranslatedFields,
  parseTranslatedMeta,
} from '@op/common/client';
import { toast } from '@op/sense/Toast';
import { useLocale } from 'next-intl';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useTranslations } from '@/lib/i18n';

import type { ProposalTranslation } from '../ProposalPreview';
import { TranslateBanner } from '../TranslateBanner';
import type { RubricTranslatedMeta } from '../rubricTemplate';
import {
  getProposalDetectionText,
  getRubricDetectionText,
} from '../translationDetectionText';
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
  const t = useTranslations();
  const locale = useLocale();
  const { assignment, rubricTemplate } = useReviewForm();
  const proposal = assignment.proposal;

  const supportedLocale = (SUPPORTED_LOCALES as readonly string[]).includes(
    locale,
  )
    ? (locale as SupportedLocale)
    : null;

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [translated, setTranslated] = useState<{
    proposal?: TranslatedFields;
    rubric?: TranslatedFields;
    sourceLocale: string;
  } | null>(null);

  // Flipped true on Translate, false on View Original. A response that lands
  // after the reviewer reverts checks this before writing state, so the revert
  // can't be undone by an in-flight request (as in useTranslateDecision).
  const translatingRef = useRef(false);

  // One banner drives both requests, so they succeed or fail as one. A failure
  // discards whatever the other request returned, and clearing the ref makes
  // its late success a no-op via the guards below. Keeping a partial result
  // would hide the banner — the only retry control — with one pane still
  // untranslated, and a rubric-only success renders no "View original" either,
  // stranding the screen until a reload.
  const onTranslateError = useCallback(() => {
    translatingRef.current = false;
    setTranslated(null);
    toast.error(t('Failed to translate content'));
  }, [t]);

  const translateProposalMutation =
    trpc.translation.translateProposal.useMutation({
      onSuccess: (data) => {
        if (!translatingRef.current) {
          return;
        }
        setTranslated((prev) => ({
          ...prev,
          proposal: data.translated,
          sourceLocale: prev?.sourceLocale || data.sourceLocale,
        }));
      },
      onError: onTranslateError,
    });

  const translateRubricMutation = trpc.translation.translateRubric.useMutation({
    onSuccess: (data) => {
      if (!translatingRef.current) {
        return;
      }
      setTranslated((prev) => ({
        ...prev,
        rubric: data.translated,
        sourceLocale: prev?.sourceLocale || data.sourceLocale,
      }));
    },
    onError: onTranslateError,
  });

  // One sample per surface rather than one concatenated blob: a rubric authored
  // in Spanish must offer translation even when the proposal is in English, and
  // vice versa.
  const samples = useMemo(
    () => [
      getProposalDetectionText(proposal),
      getRubricDetectionText(rubricTemplate),
    ],
    [proposal, rubricTemplate],
  );
  const needsTranslation = useAnyContentNeedsTranslation(samples);

  const handleTranslate = useCallback(() => {
    if (!supportedLocale) {
      return;
    }
    translatingRef.current = true;
    translateProposalMutation.mutate({
      profileId: proposal.profileId,
      targetLocale: supportedLocale,
    });
    translateRubricMutation.mutate({
      assignmentId,
      targetLocale: supportedLocale,
    });
  }, [
    assignmentId,
    proposal.profileId,
    supportedLocale,
    translateProposalMutation,
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

  const value = useMemo<ReviewTranslationValue>(
    () => ({
      proposal: translated?.proposal
        ? {
            htmlContent: translated.proposal,
            sourceLanguageName,
            onViewOriginal: handleViewOriginal,
          }
        : undefined,
      rubricMeta: translated?.rubric
        ? parseTranslatedMeta(translated.rubric)
        : null,
    }),
    [translated, sourceLanguageName, handleViewOriginal],
  );

  const showBanner =
    !!supportedLocale && needsTranslation && !bannerDismissed && !translated;

  return (
    <ReviewTranslationContext.Provider value={value}>
      {children}

      {showBanner && (
        <TranslateBanner
          onTranslate={handleTranslate}
          onDismiss={() => setBannerDismissed(true)}
          isTranslating={
            translateProposalMutation.isPending ||
            translateRubricMutation.isPending
          }
          languageName={languageNames.of(locale) ?? locale}
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
