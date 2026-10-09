import { logger } from '@op/logging/client';
import { useEffect, useState } from 'react';
import { z } from 'zod';

import type { ScreenId, WizardAnswers } from './flow';

export interface WizardProgress {
  screen: ScreenId;
  answers: WizardAnswers;
}

const STORAGE_KEY = 'create-process-wizard';

const subjectSchema = z.enum(['funding', 'ideas', 'people', 'else']);

const progressSchema: z.ZodType<WizardProgress> = z.object({
  screen: z.enum([
    'intro',
    'type',
    'shape',
    'grantDecision',
    'subjects',
    'cadence',
    'focus',
    'submits',
    'decision',
    'mapping',
    'name',
  ]),
  answers: z.object({
    type: z.enum(['grant', 'pb', 'other']).nullable(),
    shape: z
      .enum(['single', 'loi', 'ideas', 'proposals', 'custom', 'blank'])
      .nullable(),
    grantDecision: z.enum(['rubric', 'applicants', 'hybrid']).nullable(),
    other: z.object({
      subjects: z.array(subjectSchema),
      elseText: z.string(),
      focus: subjectSchema.nullable(),
      cadence: z.enum(['timeline', 'ongoing']).nullable(),
      submits: z
        .enum(['applications', 'proposals', 'rough', 'nominations', 'none'])
        .nullable(),
      decision: z.enum(['vote', 'review', 'both', 'agree']).nullable(),
    }),
    name: z.string(),
  }),
});

/** `undefined` until mounted, so the server render and hydration agree. */
export function useSavedWizardProgress(): WizardProgress | null | undefined {
  const [saved, setSaved] = useState<WizardProgress | null>();

  useEffect(() => {
    setSaved(readWizardProgress());
  }, []);

  return saved;
}

export function saveWizardProgress(progress: WizardProgress) {
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

export function readWizardProgress(): WizardProgress | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = progressSchema.safeParse(JSON.parse(raw));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
