'use client';

import { createContext, useContext, useState } from 'react';

interface DecisionTranslation {
  headline?: string;
  phaseDescription?: string;
  additionalInfo?: string;
  description?: string;
  phases?: Array<{ id: string; name: string }>;
}

interface DecisionTranslationContextValue {
  translation: DecisionTranslation | null;
  setTranslation: (translation: DecisionTranslation | null) => void;
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
    return null;
  }
  return ctx.translation;
}

export function useSetDecisionTranslation(): (
  translation: DecisionTranslation | null,
) => void {
  const ctx = useContext(DecisionTranslationContext);
  if (!ctx) {
    return () => {};
  }
  return ctx.setTranslation;
}
