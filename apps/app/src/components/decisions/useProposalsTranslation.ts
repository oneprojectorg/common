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

import { useTranslations } from '@/lib/i18n';

import { useSetDecisionTranslation } from './DecisionTranslationContext';

type DecisionTranslationPatch = Partial<{
  headline: string;
  phaseDescription: string;
  additionalInfo: string;
  description: string;
  phases: Array<{ id: string; name: string }>;
  posts: Record<string, PostTranslation>;
  resources: Record<string, ResourceTranslation>;
}>;

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
  // Translation is "active" between handleTranslate and handleViewOriginal.
  // Each in-flight mutation captures this id at mutate-time; a late onSuccess
  // whose id no longer matches is dropped, so a click on View Original can't
  // be steamrolled by a translate response that lands after the revert.
  const translateRequestIdRef = useRef(0);

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
        phases: patch.phases ?? prev?.phases ?? [],
        posts: { ...(prev?.posts ?? {}), ...(patch.posts ?? {}) },
        resources: { ...(prev?.resources ?? {}), ...(patch.resources ?? {}) },
      }));
    },
    [setDecisionTranslation],
  );

  const failedToTranslateToast = useCallback(() => {
    toast.error({ message: t('Failed to translate content') });
  }, [t]);

  const translateBatchMutation =
    trpc.translation.translateProposals.useMutation({
      onError: failedToTranslateToast,
    });
  const translateDecisionMutation =
    trpc.translation.translateDecision.useMutation({
      onError: failedToTranslateToast,
    });
  const translatePostsMutation = trpc.translation.translatePosts.useMutation({
    onError: failedToTranslateToast,
  });
  const translateResourcesMutation =
    trpc.translation.translateResources.useMutation({
      onError: failedToTranslateToast,
    });

  const handleTranslate = useCallback(() => {
    if (!supportedLocale) {
      return;
    }
    translateRequestIdRef.current += 1;
    const requestId = translateRequestIdRef.current;
    // `mutate` accepts a per-call onSuccess that fires after the hook-level
    // one; closing over `requestId` lets each response check whether it's
    // still the latest before mutating state.
    const isCurrent = () => translateRequestIdRef.current === requestId;

    const profileIds = allProposals.map((p) => p.profileId);
    if (profileIds.length) {
      translateBatchMutation.mutate(
        { profileIds, targetLocale: supportedLocale },
        {
          onSuccess: (data) => {
            if (!isCurrent()) {
              return;
            }
            setTranslationState({
              translations: data.translations,
              sourceLocale: data.sourceLocale,
            });
          },
        },
      );
    }
    if (decisionProfileId) {
      translateDecisionMutation.mutate(
        { decisionProfileId, targetLocale: supportedLocale },
        {
          onSuccess: (data) => {
            if (!isCurrent()) {
              return;
            }
            seedTranslationState(data.sourceLocale);
            if (
              !data.headline &&
              !data.phaseDescription &&
              !data.additionalInfo &&
              !data.description &&
              data.phases.length === 0
            ) {
              return;
            }
            patchDecisionTranslation({
              headline: data.headline,
              phaseDescription: data.phaseDescription,
              additionalInfo: data.additionalInfo,
              description: data.description,
              phases: data.phases,
            });
          },
        },
      );
      translatePostsMutation.mutate(
        { profileId: decisionProfileId, targetLocale: supportedLocale },
        {
          onSuccess: (data) => {
            if (!isCurrent()) {
              return;
            }
            seedTranslationState(data.sourceLocale);
            if (Object.keys(data.translations).length === 0) {
              return;
            }
            patchDecisionTranslation({ posts: data.translations });
          },
        },
      );
      translateResourcesMutation.mutate(
        { profileId: decisionProfileId, targetLocale: supportedLocale },
        {
          onSuccess: (data) => {
            if (!isCurrent()) {
              return;
            }
            seedTranslationState(data.sourceLocale);
            if (Object.keys(data.translations).length === 0) {
              return;
            }
            patchDecisionTranslation({ resources: data.translations });
          },
        },
      );
    }
  }, [
    translateBatchMutation,
    translateDecisionMutation,
    translatePostsMutation,
    translateResourcesMutation,
    allProposals,
    supportedLocale,
    decisionProfileId,
    seedTranslationState,
    patchDecisionTranslation,
  ]);

  const handleViewOriginal = useCallback(() => {
    // Bumping the request id retires any in-flight translate mutation: their
    // onSuccess will see a fresh id and drop the patch, so a slow translate
    // response can't re-apply translation after the user reverted.
    translateRequestIdRef.current += 1;
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
    isTranslating:
      translateBatchMutation.isPending ||
      translateDecisionMutation.isPending ||
      translatePostsMutation.isPending ||
      translateResourcesMutation.isPending,
  };
};
