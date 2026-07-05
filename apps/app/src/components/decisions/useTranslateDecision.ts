'use client';

import { trpc } from '@op/api/client';
import {
  type PostTranslation,
  type Proposal,
  type ProposalTranslation,
  type ResourceTranslation,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '@op/common/client';
import { toast } from '@op/ui/Toast';
import { useLocale } from 'next-intl';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useContentNeedsTranslation } from '@/hooks/useContentNeedsTranslation';
import { useTranslations } from '@/lib/i18n';

import { useSetDecisionTranslation } from './DecisionTranslationContext';

type DecisionTranslationPatch = Partial<{
  headline: string;
  phaseDescription: string;
  additionalInfo: string;
  description: string;
  overviewHeadline: string;
  overviewDescription: string;
  overviewBody: string;
  phases: Array<{ id: string; name: string }>;
  posts: Record<string, PostTranslation>;
  resources: Record<string, ResourceTranslation>;
}>;

// fallow-ignore-next-line complexity
export const useTranslateDecision = ({
  proposals,
  decisionProfileId,
  contentText,
}: {
  proposals: Proposal[];
  decisionProfileId?: string | null;
  /** Plain-text sample of the content, used to decide whether to offer translation. */
  contentText: string;
}) => {
  const t = useTranslations();
  const locale = useLocale();
  const needsTranslation = useContentNeedsTranslation(contentText);
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
  // Flipped true on Translate, false on View Original. Late mutation
  // responses check this before mutating state, so a click on View Original
  // can't be steamrolled by a translate response that lands after the revert.
  const translatingRef = useRef(false);

  const seedTranslationState = useCallback((sourceLocale: string) => {
    if (!sourceLocale) {
      return;
    }
    setTranslationState((prev) =>
      prev ? prev : { translations: {}, sourceLocale },
    );
  }, []);

  const patchDecisionTranslation = useCallback(
    (patch: DecisionTranslationPatch) => {
      setDecisionTranslation((prev) => ({
        headline: patch.headline ?? prev?.headline,
        phaseDescription: patch.phaseDescription ?? prev?.phaseDescription,
        additionalInfo: patch.additionalInfo ?? prev?.additionalInfo,
        description: patch.description ?? prev?.description,
        overviewHeadline: patch.overviewHeadline ?? prev?.overviewHeadline,
        overviewDescription:
          patch.overviewDescription ?? prev?.overviewDescription,
        overviewBody: patch.overviewBody ?? prev?.overviewBody,
        phases: patch.phases ?? prev?.phases ?? [],
        posts: { ...(prev?.posts ?? {}), ...(patch.posts ?? {}) },
        resources: { ...(prev?.resources ?? {}), ...(patch.resources ?? {}) },
      }));
    },
    [setDecisionTranslation],
  );

  const onTranslateError = useCallback(() => {
    toast.error({ message: t('Failed to translate content') });
  }, [t]);

  const translateBatchMutation =
    trpc.translation.translateProposals.useMutation({
      onSuccess: (data) => {
        if (!translatingRef.current) {
          return;
        }
        setTranslationState({
          translations: data.translations,
          sourceLocale: data.sourceLocale,
        });
      },
      onError: onTranslateError,
    });

  const translateDecisionMutation =
    trpc.translation.translateDecision.useMutation({
      onSuccess: (data) => {
        if (!translatingRef.current) {
          return;
        }
        seedTranslationState(data.sourceLocale);
        if (
          !data.headline &&
          !data.phaseDescription &&
          !data.additionalInfo &&
          !data.description &&
          !data.overviewHeadline &&
          !data.overviewDescription &&
          !data.overviewBody &&
          data.phases.length === 0
        ) {
          return;
        }
        patchDecisionTranslation({
          headline: data.headline,
          phaseDescription: data.phaseDescription,
          additionalInfo: data.additionalInfo,
          description: data.description,
          overviewHeadline: data.overviewHeadline,
          overviewDescription: data.overviewDescription,
          overviewBody: data.overviewBody,
          phases: data.phases,
        });
      },
      onError: onTranslateError,
    });

  const translatePostsMutation = trpc.translation.translatePosts.useMutation({
    onSuccess: (data) => {
      if (!translatingRef.current) {
        return;
      }
      seedTranslationState(data.sourceLocale);
      if (Object.keys(data.translations).length === 0) {
        return;
      }
      patchDecisionTranslation({ posts: data.translations });
    },
    onError: onTranslateError,
  });

  const translateResourcesMutation =
    trpc.translation.translateResources.useMutation({
      onSuccess: (data) => {
        if (!translatingRef.current) {
          return;
        }
        seedTranslationState(data.sourceLocale);
        if (Object.keys(data.translations).length === 0) {
          return;
        }
        patchDecisionTranslation({ resources: data.translations });
      },
      onError: onTranslateError,
    });

  const handleTranslate = useCallback(() => {
    if (!supportedLocale) {
      return;
    }
    translatingRef.current = true;
    const profileIds = proposals.map((p) => p.profileId);
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
    proposals,
    supportedLocale,
    decisionProfileId,
  ]);

  const handleViewOriginal = useCallback(() => {
    translatingRef.current = false;
    setTranslationState(null);
    setDecisionTranslation(null);
  }, [setDecisionTranslation]);

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
    needsTranslation &&
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
    isTranslating:
      translateBatchMutation.isPending ||
      translateDecisionMutation.isPending ||
      translatePostsMutation.isPending ||
      translateResourcesMutation.isPending,
  };
};
