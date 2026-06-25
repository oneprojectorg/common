'use client';

import type { PostTranslation, ResourceTranslation } from '@op/common/client';
import {
  type Dispatch,
  type SetStateAction,
  createContext,
  useContext,
  useState,
} from 'react';

interface DecisionTranslation {
  headline?: string;
  phaseDescription?: string;
  additionalInfo?: string;
  description?: string;
  phases: Array<{ id: string; name: string }>;
  posts: Record<string, PostTranslation>;
  resources: Record<string, ResourceTranslation>;
}

interface DecisionTranslationContextValue {
  translation: DecisionTranslation | null;
  setTranslation: Dispatch<SetStateAction<DecisionTranslation | null>>;
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

  return (
    <DecisionTranslationContext.Provider
      value={{ translation, setTranslation }}
    >
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

/**
 * Optional variant for components like PostItem / ResourceCard that render
 * both inside and outside a decision context. Returns null when no provider
 * is mounted, so the caller can fall back to original content.
 */
export function useDecisionTranslationOptional(): DecisionTranslation | null {
  const ctx = useContext(DecisionTranslationContext);
  return ctx?.translation ?? null;
}

export function useSetDecisionTranslation(): Dispatch<
  SetStateAction<DecisionTranslation | null>
> {
  const ctx = useContext(DecisionTranslationContext);
  if (!ctx) {
    throw new Error(
      'useSetDecisionTranslation must be used within a DecisionTranslationProvider',
    );
  }
  return ctx.setTranslation;
}
