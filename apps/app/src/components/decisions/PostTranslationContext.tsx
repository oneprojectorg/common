'use client';

import type { UpdateTranslation } from '@op/common/client';
import { type ReactNode, createContext, useContext, useState } from 'react';

type PostTranslations = Record<string, UpdateTranslation>;

interface PostTranslationContextValue {
  translations: PostTranslations;
  setTranslations: (next: PostTranslations | null) => void;
}

const PostTranslationContext =
  createContext<PostTranslationContextValue | null>(null);

export function PostTranslationProvider({ children }: { children: ReactNode }) {
  const [translations, setTranslationsState] = useState<PostTranslations>({});

  const setTranslations = (next: PostTranslations | null) => {
    setTranslationsState(next ?? {});
  };

  return (
    <PostTranslationContext.Provider value={{ translations, setTranslations }}>
      {children}
    </PostTranslationContext.Provider>
  );
}

export function usePostTranslation(
  postId: string | null | undefined,
): UpdateTranslation | undefined {
  const ctx = useContext(PostTranslationContext);
  if (!ctx || !postId) {
    return undefined;
  }
  return ctx.translations[postId];
}

export function useSetPostTranslations(): (
  next: PostTranslations | null,
) => void {
  const ctx = useContext(PostTranslationContext);
  if (!ctx) {
    throw new Error(
      'useSetPostTranslations must be used within a PostTranslationProvider',
    );
  }
  return ctx.setTranslations;
}
