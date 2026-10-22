'use client';

import { trpc } from '@op/api/client';
import type { ResourceTranslation, SupportedLocale } from '@op/common/client';
import { type ReactNode, createContext, useContext } from 'react';

import { type TranslateLinkState, useTranslateLink } from './useTranslateLink';

interface DecisionTranslation {
  headline?: string;
  phaseDescription?: string;
  additionalInfo?: string;
  description?: string;
  overviewHeadline?: string;
  overviewDescription?: string;
  overviewBody?: string;
  phases: Array<{ id: string; name: string }>;
  resources: Record<string, ResourceTranslation>;
}

interface DecisionTranslationContextValue {
  translation: DecisionTranslation | null;
  link: TranslateLinkState;
}

const DecisionTranslationContext =
  createContext<DecisionTranslationContextValue | null>(null);

/** One link translates the process: overview, phase copy, phase names and pinned resources. */
export function DecisionTranslationProvider({
  decisionProfileId,
  detectionText = '',
  children,
}: {
  decisionProfileId?: string | null;
  detectionText?: string;
  children: ReactNode;
}) {
  const translateDecision = trpc.translation.translateDecision.useMutation();
  const translateResources = trpc.translation.translateResources.useMutation();

  const request = async (
    targetLocale: SupportedLocale,
  ): Promise<DecisionTranslation | undefined> => {
    if (!decisionProfileId) {
      return undefined;
    }
    const [decision, resources] = await Promise.all([
      translateDecision.mutateAsync({ decisionProfileId, targetLocale }),
      translateResources.mutateAsync({
        profileId: decisionProfileId,
        targetLocale,
      }),
    ]);
    const { sourceLocale: _source, targetLocale: _target, ...copy } = decision;
    const translation = { ...copy, resources: resources.translations };
    return hasTranslatedText(translation) ? translation : undefined;
  };

  const { translation, ...link } = useTranslateLink({
    detectionText,
    enabled: !!decisionProfileId,
    request,
  });

  return (
    <DecisionTranslationContext.Provider
      value={{ translation: translation ?? null, link }}
    >
      {children}
    </DecisionTranslationContext.Provider>
  );
}

/**
 * Returns the current decision translation, or null when no provider is
 * mounted or the process is showing its original text. Safe to call from
 * components that render both inside (decision view) and outside (profile
 * feed, proposal detail page) the provider.
 */
export function useDecisionTranslation(): DecisionTranslation | null {
  return useContext(DecisionTranslationContext)?.translation ?? null;
}

export function useDecisionTranslateLink(): TranslateLinkState | null {
  return useContext(DecisionTranslationContext)?.link ?? null;
}

const hasTranslatedText = ({
  phases,
  resources,
  ...copy
}: DecisionTranslation) =>
  phases.length > 0 ||
  Object.keys(resources).length > 0 ||
  Object.values(copy).some(Boolean);
