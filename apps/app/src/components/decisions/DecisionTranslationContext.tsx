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

/**
 * Returns the current decision translation, or null when no provider is
 * mounted or no translation has been requested. Safe to call from components
 * that render both inside (decision view) and outside (profile feed, comments
 * modal, proposal detail page) the provider.
 */
export function useDecisionTranslation(): DecisionTranslation | null {
  return useContext(DecisionTranslationContext)?.translation ?? null;
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
