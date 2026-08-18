'use client';

import { useContentNeedsTranslation } from '@/hooks/useContentNeedsTranslation';
import { useTranslationBanner } from '@/hooks/useTranslationLocale';
import { trpc } from '@op/api/client';
import type { Proposal, ProposalTranslation } from '@op/common/client';
import { toast } from '@op/sense/Toast';
import { useCallback, useMemo, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { getProposalDetectionText } from './translationDetectionText';

/** The `translation` prop `ProposalPreview` accepts, or undefined when untranslated. */
type ProposalPreviewTranslation =
  | {
      htmlContent: ProposalTranslation;
      sourceLanguageName: string;
      onViewOriginal: () => void;
    }
  | undefined;

/**
 * Per-proposal translation: detection, the translate mutation, and the banner
 * state for one proposal.
 *
 * Shared by every screen that renders a single proposal — the proposal page and
 * the rubric review screen — so a reviewer gets the same affordance as a reader.
 * The review screen previously had none (ONE COWOP report).
 */
export const useTranslateProposal = (proposal: Proposal) => {
  const t = useTranslations();

  const [translated, setTranslated] = useState<{
    translated: ProposalTranslation;
    sourceLocale: string;
  } | null>(null);

  // Only offer translation when the proposal's own content is in a language
  // other than the reader's locale — no badge for same-language proposals.
  const detectionText = useMemo(
    () => getProposalDetectionText(proposal),
    [proposal],
  );
  const needsTranslation = useContentNeedsTranslation(detectionText);

  const {
    targetLocale,
    targetLanguageName,
    getLanguageName,
    showBanner,
    dismissBanner,
  } = useTranslationBanner({
    needsTranslation,
    isTranslated: !!translated,
  });

  const translateMutation = trpc.translation.translateProposal.useMutation({
    onSuccess: (data) => {
      setTranslated({
        translated: data.translated,
        sourceLocale: data.sourceLocale,
      });
    },
    onError: () => {
      toast.error(t('Failed to translate content'));
    },
  });

  const handleTranslate = useCallback(() => {
    if (!targetLocale) {
      return;
    }
    translateMutation.mutate({
      profileId: proposal.profileId,
      targetLocale,
    });
  }, [translateMutation, proposal.profileId, targetLocale]);

  const handleViewOriginal = useCallback(() => setTranslated(null), []);

  const translation: ProposalPreviewTranslation = useMemo(
    () =>
      translated
        ? {
            htmlContent: translated.translated,
            sourceLanguageName: getLanguageName(translated.sourceLocale),
            onViewOriginal: handleViewOriginal,
          }
        : undefined,
    [translated, getLanguageName, handleViewOriginal],
  );

  return {
    /** Pass straight to `ProposalPreview`'s `translation` prop. */
    translation,
    showBanner,
    isTranslating: translateMutation.isPending,
    targetLanguageName,
    handleTranslate,
    dismissBanner,
  };
};
