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

/** Storage is best-effort: without it the wizard still runs, it only forgets. */
function withStorage<T>(run: (storage: Storage) => T, fallback: T): T {
  try {
    return run(sessionStorage);
  } catch (error) {
    logger.warn('Session storage unavailable for the create-process wizard', {
      error,
    });
    return fallback;
  }
}

export function saveWizardProgress(progress: WizardState) {
  withStorage(
    (storage) => storage.setItem(STORAGE_KEY, JSON.stringify(progress)),
    undefined,
  );
}

export function clearWizardProgress() {
  withStorage((storage) => storage.removeItem(STORAGE_KEY), undefined);
}

const ORIGIN_KEY = 'create-process-wizard-origin';

/** The in-app route Exit returns to; `history.back()` could leave the site. */
export function saveWizardOrigin(pathname: string) {
  withStorage((storage) => storage.setItem(ORIGIN_KEY, pathname), undefined);
}

export function takeWizardOrigin(): string | null {
  const origin = withStorage((storage) => storage.getItem(ORIGIN_KEY), null);
  clearWizardOrigin();

  return origin;
}

/** Also on success, or a later direct visit's Exit would return to the old page. */
export function clearWizardOrigin() {
  withStorage((storage) => storage.removeItem(ORIGIN_KEY), undefined);
}

export function readWizardProgress(): WizardState | null {
  const raw = withStorage((storage) => storage.getItem(STORAGE_KEY), null);

  if (!raw) {
    return null;
  }

  try {
    const parsed = progressSchema.safeParse(JSON.parse(raw));

    if (!parsed.success) {
      logger.warn(
        'Discarded create-process wizard progress with an unknown shape',
        {
          error: parsed.error,
        },
      );
      return null;
    }

    return resumeWizard(parsed.data);
  } catch (error) {
    logger.warn('Discarded unreadable create-process wizard progress', {
      error,
    });
    return null;
  }
}
