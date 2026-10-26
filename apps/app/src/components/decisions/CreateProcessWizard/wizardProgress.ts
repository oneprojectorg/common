import { logger } from '@op/logging/client';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';

import { resumeWizard, type WizardState } from './flow';

const STORAGE_KEY = 'create-process-wizard';

const progressSchema: z.ZodType<WizardState> = z.object({
  screen: z.enum([
    'intro',
    'type',
    'shape',
    'grantDecision',
    'subject',
    'cadence',
    'submits',
    'decision',
    'mapping',
    'name',
  ]),
  answers: z.object({
    type: z.enum(['grant', 'pb', 'other']).nullable(),
    shape: z.enum(['single', 'loi', 'ideas', 'proposals']).nullable(),
    grantDecision: z.enum(['rubric', 'applicants', 'hybrid']).nullable(),
    subject: z.enum(['funding', 'ideas', 'people', 'else']).nullable(),
    subjectText: z.string(),
    cadence: z.enum(['timeline', 'ongoing']).nullable(),
    submits: z
      .enum(['applications', 'proposals', 'rough', 'nominations', 'none'])
      .nullable(),
    decision: z.enum(['vote', 'review', 'both', 'agree']).nullable(),
    name: z.string(),
  }),
});

/**
 * `undefined` until mounted, so the server render and hydration agree. Leaving
 * the page in-app discards the answers; a reload never unmounts, so it keeps them.
 */
export function useSavedWizardProgress(): WizardState | null | undefined {
  const [saved, setSaved] = useState<WizardState | null>();
  // Survives Strict Mode's remount, whose cleanup has already cleared storage.
  const restored = useRef<WizardState | null | undefined>(undefined);

  useEffect(() => {
    const progress =
      restored.current === undefined ? readWizardProgress() : restored.current;
    restored.current = progress;
    setSaved(progress);

    return clearWizardProgress;
  }, []);

  return saved;
}

export function saveWizardProgress(progress: WizardState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    logger.warn('Failed to save create-process wizard progress', { error });
  }
}

export function clearWizardProgress() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing was saved if storage is unavailable.
  }
}

const ORIGIN_KEY = 'create-process-wizard-origin';

/** The in-app route Exit returns to; `history.back()` could leave the site. */
export function saveWizardOrigin(pathname: string) {
  try {
    sessionStorage.setItem(ORIGIN_KEY, pathname);
  } catch {
    // Exit falls back to the home route.
  }
}

export function takeWizardOrigin(): string | null {
  try {
    const origin = sessionStorage.getItem(ORIGIN_KEY);
    clearWizardOrigin();

    return origin;
  } catch {
    return null;
  }
}

/** Also on success, or a later direct visit's Exit would return to the old page. */
export function clearWizardOrigin() {
  try {
    sessionStorage.removeItem(ORIGIN_KEY);
  } catch {
    // Nothing was saved if storage is unavailable.
  }
}

export function readWizardProgress(): WizardState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = progressSchema.safeParse(JSON.parse(raw));

    return parsed.success ? resumeWizard(parsed.data) : null;
  } catch (error) {
    logger.warn('Failed to read create-process wizard progress', { error });
    return null;
  }
}
