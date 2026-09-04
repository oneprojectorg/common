'use client';

import { useAnyContentNeedsTranslation } from '@/hooks/useAnyContentNeedsTranslation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/**
 * Collects language-detection samples from every surface on a decision screen,
 * so the Translate control appears whenever *any* content the control would
 * translate is in a foreign language.
 *
 * `handleTranslate` (see `useTranslateDecision`) translates four things at
 * once: proposals, the decision's own copy, the updates, and the resources.
 * Detection used to be computed by whichever component owned the control, from
 * only the content that component rendered. Every surface it didn't sample
 * became untranslatable in practice — a foreign-language proposal title, a
 * foreign phase headline, or a foreign update on an otherwise English decision
 * hid the control entirely, even though clicking it would have translated them.
 *
 * Registering samples here keeps one control per screen, fed by everything on
 * it. Components outside a provider (the profile feed, the comments modal) call
 * the register hook to no effect, which is what they want.
 */
const TranslationDetectionContext = createContext<{
  register: (key: string, samples: string[]) => void;
  samples: string[];
} | null>(null);

const NO_SAMPLES: string[] = [];

export function TranslationDetectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [samplesByKey, setSamplesByKey] = useState<Record<string, string[]>>(
    {},
  );

  // Bail out when a key re-registers the same text, otherwise every render
  // that rebuilds a sample array would set state and loop.
  const register = useCallback((key: string, samples: string[]) => {
    setSamplesByKey((previous) => {
      const current = previous[key];
      if (current && isSameSamples(current, samples)) {
        return previous;
      }
      return { ...previous, [key]: samples };
    });
  }, []);

  const samples = useMemo(
    () => Object.values(samplesByKey).flat(),
    [samplesByKey],
  );

  const value = useMemo(() => ({ register, samples }), [register, samples]);

  return (
    <TranslationDetectionContext.Provider value={value}>
      {children}
    </TranslationDetectionContext.Provider>
  );
}

/**
 * Contributes `samples` under `key` to the screen's detection set. Memoize
 * `samples` at the call site — a fresh array each render is compared by value
 * here, but memoizing keeps the comparison cheap.
 *
 * `key` must be unique per mounted instance, not per component: a surface that
 * can render more than once on a screen (resources, one list per collection)
 * has to fold its own id into the key. Two instances sharing a key overwrite
 * each other, and the samples that lose are silently absent from detection.
 */
export function useRegisterTranslationSamples(key: string, samples: string[]) {
  const context = useContext(TranslationDetectionContext);
  const register = context?.register;

  useEffect(() => {
    register?.(key, samples);
  }, [register, key, samples]);
}

/**
 * Whether any registered sample is in a language other than the reader's.
 * Drives whether the Translate control renders.
 */
export function useDecisionNeedsTranslation(): boolean {
  const context = useContext(TranslationDetectionContext);
  return useAnyContentNeedsTranslation(context?.samples ?? NO_SAMPLES);
}

function isSameSamples(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
