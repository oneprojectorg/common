'use client';

import { useContentNeedsTranslation } from '@/hooks/useContentNeedsTranslation';
import { trpc } from '@op/api/client';
import {
  type Proposal,
  type ProposalTranslation,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '@op/common/client';
import { toast } from '@op/sense/Toast';
import { useLocale } from 'next-intl';
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
  const locale = useLocale();
  const supportedLocale = (SUPPORTED_LOCALES as readonly string[]).includes(
    locale,
  )
    ? (locale as SupportedLocale)
    : null;

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [translated, setTranslated] = useState<{
    translated: ProposalTranslation;
    sourceLocale: string;
  } | null>(null);

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
    if (!supportedLocale) {
      return;
    }
    translateMutation.mutate({
      profileId: proposal.profileId,
      targetLocale: supportedLocale,
    });
  }, [translateMutation, proposal.profileId, supportedLocale]);

  const handleViewOriginal = useCallback(() => setTranslated(null), []);

  // The browser's Intl API localizes the language names — no dictionary keys.
  const languageNames = useMemo(
    () => new Intl.DisplayNames([locale], { type: 'language' }),
    [locale],
  );

  const sourceLanguageName = translated
    ? (languageNames.of(
        translated.sourceLocale.toLowerCase().split('-')[0] ?? '',
      ) ?? '')
    : '';

  // Only offer translation when the proposal's own content is in a language
  // other than the reader's locale — no badge for same-language proposals.
  const detectionText = useMemo(
    () => getProposalDetectionText(proposal),
    [proposal],
  );
  const needsTranslation = useContentNeedsTranslation(detectionText);

  const translation: ProposalPreviewTranslation = translated
    ? {
        htmlContent: translated.translated,
        sourceLanguageName,
        onViewOriginal: handleViewOriginal,
      }
    : undefined;

  return {
    /** Pass straight to `ProposalPreview`'s `translation` prop. */
    translation,
    showBanner:
      !!supportedLocale && needsTranslation && !bannerDismissed && !translated,
    isTranslating: translateMutation.isPending,
    targetLanguageName: languageNames.of(locale) ?? locale,
    handleTranslate,
    dismissBanner: () => setBannerDismissed(true),
  };
};
