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
import { useCallback, useMemo, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import type { ProposalTranslation } from './ProposalPreview';
import type {
  RubricTemplateSchema,
  RubricTranslatedMeta,
} from './rubricTemplate';
import {
  getProposalDetectionText,
  getRubricDetectionText,
} from './translationDetectionText';

/** The proposal fields this needs: enough to detect, plus the translate target. */
type TranslatableProposal = Parameters<typeof getProposalDetectionText>[0] & {
  profileId: string;
};

export interface ProposalRubricTranslation {
  /** Passed straight to `ProposalPreview`; undefined until translated. */
  proposal?: ProposalTranslation;
  /** Applied to the rubric template; null until translated. */
  rubricMeta: RubricTranslatedMeta | null;
  showBanner: boolean;
  isTranslating: boolean;
  targetLanguageName: string;
  handleTranslate: () => void;
  dismissBanner: () => void;
}

/**
 * Machine translation for a screen showing one proposal beside the rubric it is
 * scored with — the reviewer's form and the admin's review summary both do.
 *
 * Shared rather than reimplemented per screen: the two panes have to move on a
 * single click and revert together, and the in-flight guards below are easy to
 * get subtly wrong. Both screens read the same rubric, so both offer the same
 * control.
 *
 * `rubricTarget` is how the rubric is addressed: by assignment on the
 * reviewer's screen, by phase on the admin summary, which holds no assignment
 * of its own. Both reach the same phase-keyed cache. Pass null only when there
 * is no rubric to reach — detection then skips it, so the control is never
 * raised by copy this cannot move.
 */
export type RubricTarget =
  | { assignmentId: string }
  | { processInstanceId: string; phaseId: string };

export const useProposalRubricTranslation = ({
  proposal,
  rubricTemplate,
  rubricTarget,
}: {
  proposal: TranslatableProposal;
  rubricTemplate: RubricTemplateSchema | null;
  rubricTarget: RubricTarget | null;
}): ProposalRubricTranslation => {
  const t = useTranslations();
  const locale = useLocale();

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
  // after the reader reverts checks this before writing state, so the revert
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

  const onRubricSuccess = {
    onSuccess: (data: {
      translated: TranslatedFields;
      sourceLocale: string;
    }) => {
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
  };

  const translateRubricMutation =
    trpc.translation.translateRubric.useMutation(onRubricSuccess);
  const translatePhaseRubricMutation =
    trpc.translation.translatePhaseRubric.useMutation(onRubricSuccess);

  // One sample per surface rather than one concatenated blob: a rubric authored
  // in Spanish must offer translation even when the proposal is in English, and
  // vice versa.
  const samples = useMemo(
    () => [
      getProposalDetectionText(proposal),
      rubricTarget ? getRubricDetectionText(rubricTemplate) : '',
    ],
    [proposal, rubricTemplate, rubricTarget],
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
    if (rubricTarget && 'assignmentId' in rubricTarget) {
      translateRubricMutation.mutate({
        assignmentId: rubricTarget.assignmentId,
        targetLocale: supportedLocale,
      });
    } else if (rubricTarget) {
      translatePhaseRubricMutation.mutate({
        ...rubricTarget,
        targetLocale: supportedLocale,
      });
    }
  }, [
    rubricTarget,
    proposal.profileId,
    supportedLocale,
    translateProposalMutation,
    translatePhaseRubricMutation,
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

  return {
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
    showBanner:
      !!supportedLocale && needsTranslation && !bannerDismissed && !translated,
    isTranslating:
      translateProposalMutation.isPending ||
      translateRubricMutation.isPending ||
      translatePhaseRubricMutation.isPending,
    targetLanguageName: languageNames.of(locale) ?? locale,
    handleTranslate,
    dismissBanner: () => setBannerDismissed(true),
  };
};
