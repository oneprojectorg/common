'use client';

import type { ResourceTranslation } from '@op/common/client';
import { type ReactNode, createContext, useContext, useState } from 'react';

type ResourceTranslations = Record<string, ResourceTranslation>;

interface ResourceTranslationContextValue {
  translations: ResourceTranslations;
  setTranslations: (next: ResourceTranslations | null) => void;
}

const ResourceTranslationContext =
  createContext<ResourceTranslationContextValue | null>(null);

export function ResourceTranslationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [translations, setTranslationsState] = useState<ResourceTranslations>(
    {},
  );

  const setTranslations = (next: ResourceTranslations | null) => {
    setTranslationsState(next ?? {});
  };

  return (
    <ResourceTranslationContext.Provider
      value={{ translations, setTranslations }}
    >
      {children}
    </ResourceTranslationContext.Provider>
  );
}

export function useResourceTranslation(
  resourceId: string | null | undefined,
): ResourceTranslation | undefined {
  const ctx = useContext(ResourceTranslationContext);
  if (!ctx || !resourceId) {
    return undefined;
  }
  return ctx.translations[resourceId];
}

export function useSetResourceTranslations(): (
  next: ResourceTranslations | null,
) => void {
  const ctx = useContext(ResourceTranslationContext);
  if (!ctx) {
    throw new Error(
      'useSetResourceTranslations must be used within a ResourceTranslationProvider',
    );
  }
  return ctx.setTranslations;
}
