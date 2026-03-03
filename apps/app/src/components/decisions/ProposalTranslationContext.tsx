'use client';

import { type ReactNode, createContext, useContext } from 'react';

type TranslationRecord = Record<
  string,
  { title?: string; category?: string; preview?: string }
>;

const ProposalTranslationContext = createContext<TranslationRecord | null>(
  null,
);

export function ProposalTranslationProvider({
  translations,
  children,
}: {
  translations: TranslationRecord;
  children: ReactNode;
}) {
  return (
    <ProposalTranslationContext.Provider value={translations}>
      {children}
    </ProposalTranslationContext.Provider>
  );
}

export function useCardTranslation(profileId: string | null | undefined) {
  const translations = useContext(ProposalTranslationContext);
  if (!translations || !profileId) {
    return undefined;
  }
  return translations[profileId];
}
