'use client';

import type { PostTranslation, ResourceTranslation } from '@op/common/client';
import { createContext, useContext, useMemo, useState } from 'react';

interface DecisionTranslation {
  headline?: string;
  phaseDescription?: string;
  additionalInfo?: string;
  description?: string;
  phases: Array<{ id: string; name: string }>;
}

type PostTranslationMap = Record<string, PostTranslation>;
type ResourceTranslationMap = Record<string, ResourceTranslation>;

interface DecisionTranslationContextValue {
  translation: DecisionTranslation | null;
  setTranslation: (translation: DecisionTranslation | null) => void;
  postTranslations: PostTranslationMap;
  setPostTranslations: (translations: PostTranslationMap) => void;
  resourceTranslations: ResourceTranslationMap;
  setResourceTranslations: (translations: ResourceTranslationMap) => void;
}

const DecisionTranslationContext =
  createContext<DecisionTranslationContextValue | null>(null);

export function DecisionTranslationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [translation, setTranslation] = useState<DecisionTranslation | null>(
    null,
  );
  const [postTranslations, setPostTranslations] = useState<PostTranslationMap>(
    {},
  );
  const [resourceTranslations, setResourceTranslations] =
    useState<ResourceTranslationMap>({});

  const value = useMemo(
    () => ({
      translation,
      setTranslation,
      postTranslations,
      setPostTranslations,
      resourceTranslations,
      setResourceTranslations,
    }),
    [translation, postTranslations, resourceTranslations],
  );

  return (
    <DecisionTranslationContext.Provider value={value}>
      {children}
    </DecisionTranslationContext.Provider>
  );
}

export function useDecisionTranslation(): DecisionTranslation | null {
  const ctx = useContext(DecisionTranslationContext);
  if (!ctx) {
    throw new Error(
      'useDecisionTranslation must be used within a DecisionTranslationProvider',
    );
  }
  return ctx.translation;
}

export function useSetDecisionTranslation(): (
  translation: DecisionTranslation | null,
) => void {
  const ctx = useContext(DecisionTranslationContext);
  if (!ctx) {
    throw new Error(
      'useSetDecisionTranslation must be used within a DecisionTranslationProvider',
    );
  }
  return ctx.setTranslation;
}

/**
 * Translated text for a post when the decision-level translate banner has
 * been activated. Returns undefined outside the provider (so the post feed
 * stays usable in non-decision surfaces) or when no translation has landed.
 */
export function usePostTranslation(
  postId: string | null | undefined,
): PostTranslation | undefined {
  const ctx = useContext(DecisionTranslationContext);
  if (!ctx || !postId) {
    return undefined;
  }
  return ctx.postTranslations[postId];
}

/**
 * Translated fields for a resource when the decision-level translate banner
 * has been activated. Same provider-optional semantics as usePostTranslation.
 */
export function useResourceTranslation(
  resourceId: string | null | undefined,
): ResourceTranslation | undefined {
  const ctx = useContext(DecisionTranslationContext);
  if (!ctx || !resourceId) {
    return undefined;
  }
  return ctx.resourceTranslations[resourceId];
}

export function useSetPostTranslations(): (
  translations: PostTranslationMap,
) => void {
  const ctx = useContext(DecisionTranslationContext);
  if (!ctx) {
    throw new Error(
      'useSetPostTranslations must be used within a DecisionTranslationProvider',
    );
  }
  return ctx.setPostTranslations;
}

export function useSetResourceTranslations(): (
  translations: ResourceTranslationMap,
) => void {
  const ctx = useContext(DecisionTranslationContext);
  if (!ctx) {
    throw new Error(
      'useSetResourceTranslations must be used within a DecisionTranslationProvider',
    );
  }
  return ctx.setResourceTranslations;
}
