'use client';

import { createContext, useContext, useState } from 'react';

import { DecisionInstanceHeader } from './DecisionInstanceHeader';

interface DecisionTranslation {
  name?: string;
  description?: string;
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
    <DecisionTranslationContext.Provider value={{ translation, setTranslation }}>
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

export function DecisionTranslationWrapper({
  backTo,
  title,
  decisionSlug,
  decisionProfileId,
  children,
}: {
  backTo: { label?: string; href: string };
  title: string;
  decisionSlug?: string;
  decisionProfileId?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <DecisionTranslationProvider>
      <DecisionTranslationWrapperInner
        backTo={backTo}
        title={title}
        decisionSlug={decisionSlug}
        decisionProfileId={decisionProfileId}
      >
        {children}
      </DecisionTranslationWrapperInner>
    </DecisionTranslationProvider>
  );
}

function DecisionTranslationWrapperInner({
  backTo,
  title,
  decisionSlug,
  decisionProfileId,
  children,
}: {
  backTo: { label?: string; href: string };
  title: string;
  decisionSlug?: string;
  decisionProfileId?: string | null;
  children?: React.ReactNode;
}) {
  const translation = useDecisionTranslation();
  const resolvedTitle = translation?.name ?? title;

  return (
    <>
      <DecisionInstanceHeader
        backTo={backTo}
        title={resolvedTitle}
        decisionSlug={decisionSlug}
        decisionProfileId={decisionProfileId}
      />
      {children}
    </>
  );
}
