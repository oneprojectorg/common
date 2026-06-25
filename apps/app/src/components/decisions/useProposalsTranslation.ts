'use client';

import { trpc } from '@op/api/client';
import {
  type Proposal,
  type ProposalTranslation,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '@op/common/client';
import { toast } from '@op/ui/Toast';
import { useLocale } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  useSetDecisionTranslation,
  useSetPostTranslations,
  useSetResourceTranslations,
} from './DecisionTranslationContext';

// fallow-ignore-next-line complexity
export const useProposalsTranslation = ({
  allProposals,
  decisionProfileId,
}: {
  allProposals: Proposal[];
  decisionProfileId?: string | null;
}) => {
  const t = useTranslations();
  const locale = useLocale();
  const supportedLocale = (SUPPORTED_LOCALES as readonly string[]).includes(
    locale,
  )
    ? (locale as SupportedLocale)
    : null;

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [translationState, setTranslationState] = useState<{
    translations: Record<string, ProposalTranslation>;
    sourceLocale: string;
  } | null>(null);
  const setDecisionTranslation = useSetDecisionTranslation();
  const setPostTranslations = useSetPostTranslations();
  const setResourceTranslations = useSetResourceTranslations();

  const translateBatchMutation =
    trpc.translation.translateProposals.useMutation({
      onSuccess: (data) => {
        setTranslationState({
          translations: data.translations,
          sourceLocale: data.sourceLocale,
        });
      },
    });

  const translateDecisionMutation =
    trpc.translation.translateDecision.useMutation({
      onSuccess: (data) => {
        if (data.sourceLocale) {
          setTranslationState((prev) =>
            prev ? prev : { translations: {}, sourceLocale: data.sourceLocale },
          );
        }
        if (
          !data.headline &&
          !data.phaseDescription &&
          !data.additionalInfo &&
          !data.description &&
          data.phases.length === 0
        ) {
          return;
        }
        setDecisionTranslation({
          headline: data.headline,
          phaseDescription: data.phaseDescription,
          additionalInfo: data.additionalInfo,
          description: data.description,
          phases: data.phases,
        });
      },
      onError: () => {
        toast.error({ message: t('Failed to translate content') });
      },
    });

  // Translate the decision's "Updates" feed (top-level posts) so the side
  // panel content matches the rest of the page when the user opts in.
  const translatePostsMutation = trpc.translation.translatePosts.useMutation({
    onSuccess: (data) => {
      if (Object.keys(data.translations).length === 0) {
        return;
      }
      if (data.sourceLocale) {
        setTranslationState((prev) =>
          prev ? prev : { translations: {}, sourceLocale: data.sourceLocale },
        );
      }
      setPostTranslations(data.translations);
    },
  });

  // Translate the decision's "Resources" tab — title/description on each
  // resource. Same side panel surface as Updates.
  const translateResourcesMutation =
    trpc.translation.translateResources.useMutation({
      onSuccess: (data) => {
        if (Object.keys(data.translations).length === 0) {
          return;
        }
        if (data.sourceLocale) {
          setTranslationState((prev) =>
            prev ? prev : { translations: {}, sourceLocale: data.sourceLocale },
          );
        }
        setResourceTranslations(data.translations);
      },
    });

  const handleTranslate = useCallback(() => {
    if (!supportedLocale) {
      return;
    }
    const profileIds = allProposals.map((p) => p.profileId);
    if (profileIds.length) {
      translateBatchMutation.mutate({
        profileIds,
        targetLocale: supportedLocale,
      });
    }
    if (decisionProfileId) {
      translateDecisionMutation.mutate({
        decisionProfileId,
        targetLocale: supportedLocale,
      });
      translatePostsMutation.mutate({
        profileId: decisionProfileId,
        targetLocale: supportedLocale,
      });
      translateResourcesMutation.mutate({
        profileId: decisionProfileId,
        targetLocale: supportedLocale,
      });
    }
  }, [
    translateBatchMutation,
    translateDecisionMutation,
    translatePostsMutation,
    translateResourcesMutation,
    allProposals,
    supportedLocale,
    decisionProfileId,
  ]);

  const handleViewOriginal = useCallback(() => {
    setTranslationState(null);
    setDecisionTranslation(null);
    setPostTranslations({});
    setResourceTranslations({});
  }, [setDecisionTranslation, setPostTranslations, setResourceTranslations]);

  const languageNames = useMemo(
    () => new Intl.DisplayNames([locale], { type: 'language' }),
    [locale],
  );
  const sourceLanguageName = translationState
    ? (languageNames.of(
        translationState.sourceLocale.toLowerCase().split('-')[0] ?? '',
      ) ?? '')
    : '';
  const targetLanguageName = languageNames.of(locale) ?? locale;

  const showBanner =
    !!supportedLocale &&
    supportedLocale !== 'en' &&
    !bannerDismissed &&
    !translationState;

  return {
    translationState,
    showBanner,
    sourceLanguageName,
    targetLanguageName,
    handleTranslate,
    handleViewOriginal,
    dismissBanner: () => setBannerDismissed(true),
    isTranslating: translateBatchMutation.isPending,
  };
};
