'use client';

import { useTranslationBanner } from '@/hooks/useTranslationLocale';
import { trpc } from '@op/api/client';
import type {
  PostTranslation,
  Proposal,
  ProposalTranslation,
  ResourceTranslation,
} from '@op/common/client';
import { toast } from '@op/sense/Toast';
import { useCallback, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useSetDecisionTranslation } from './DecisionTranslationContext';

// Mirrors the `profileIds` cap on the translation.translateProposals endpoint
// (services/api). Longer proposal lists are split into chunks of this size.
const MAX_PROPOSALS_PER_TRANSLATE = 100;

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

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
  needsTranslation,
}: {
  proposals: Proposal[];
  decisionProfileId?: string | null;
  /**
   * Whether the content is in a language other than the reader's locale. The
   * caller owns detection so it can pick the right strategy — a single sample
   * for the overview, per-proposal (pagination-aware) for the list.
   */
  needsTranslation: boolean;
}) => {
  const t = useTranslations();

  const [translationState, setTranslationState] = useState<{
    translations: Record<string, ProposalTranslation>;
    sourceLocale: string;
  } | null>(null);

  const {
    targetLocale,
    targetLanguageName,
    getLanguageName,
    showBanner,
    dismissBanner,
  } = useTranslationBanner({
    needsTranslation,
    isTranslated: !!translationState,
  });
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
    toast.error(t('Failed to translate content'));
  }, [t]);

  const translateBatchMutation =
    trpc.translation.translateProposals.useMutation({
      // Merge rather than replace: long lists are sent as several chunks, and
      // each chunk's response only carries its own proposals' translations.
      onSuccess: (data) => {
        if (!translatingRef.current) {
          return;
        }
        setTranslationState((prev) => ({
          translations: { ...(prev?.translations ?? {}), ...data.translations },
          sourceLocale: prev?.sourceLocale || data.sourceLocale,
        }));
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
    if (!targetLocale) {
      return;
    }
    translatingRef.current = true;
    const profileIds = proposals.map((p) => p.profileId);
    for (const batch of chunk(profileIds, MAX_PROPOSALS_PER_TRANSLATE)) {
      translateBatchMutation.mutate({
        profileIds: batch,
        targetLocale,
      });
    }
    if (decisionProfileId) {
      translateDecisionMutation.mutate({
        decisionProfileId,
        targetLocale,
      });
      translatePostsMutation.mutate({
        profileId: decisionProfileId,
        targetLocale,
      });
      translateResourcesMutation.mutate({
        profileId: decisionProfileId,
        targetLocale,
      });
    }
  }, [
    translateBatchMutation,
    translateDecisionMutation,
    translatePostsMutation,
    translateResourcesMutation,
    proposals,
    targetLocale,
    decisionProfileId,
  ]);

  const handleViewOriginal = useCallback(() => {
    translatingRef.current = false;
    setTranslationState(null);
    setDecisionTranslation(null);
  }, [setDecisionTranslation]);

  return {
    translationState,
    showBanner,
    sourceLanguageName: getLanguageName(translationState?.sourceLocale),
    targetLanguageName,
    handleTranslate,
    handleViewOriginal,
    dismissBanner,
    isTranslating:
      translateBatchMutation.isPending ||
      translateDecisionMutation.isPending ||
      translatePostsMutation.isPending ||
      translateResourcesMutation.isPending,
  };
};
