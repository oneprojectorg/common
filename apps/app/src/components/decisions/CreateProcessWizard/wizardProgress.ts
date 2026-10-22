import { logger } from '@op/logging/client';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';

import {
  isScreenComplete,
  previousScreen,
  reconcileAnswers,
  screensFor,
  type ScreenId,
  type WizardAnswers,
} from './flow';

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

/**
 * `undefined` until mounted, so the server render and hydration agree. Leaving
 * the page in-app discards the answers; a reload never unmounts, so it keeps them.
 */
export function useSavedWizardProgress(): WizardProgress | null | undefined {
  const [saved, setSaved] = useState<WizardProgress | null>();
  // Survives Strict Mode's remount, whose cleanup has already cleared storage.
  const restored = useRef<WizardProgress | null | undefined>(undefined);

  useEffect(() => {
    const progress =
      restored.current === undefined ? readWizardProgress() : restored.current;
    restored.current = progress;
    setSaved(progress);

    return clearWizardProgress;
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
    sessionStorage.removeItem(ORIGIN_KEY);

    return origin;
  } catch {
    return null;
  }
}

export function readWizardProgress(): WizardProgress | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = progressSchema.safeParse(JSON.parse(raw));

    return parsed.success ? resumableProgress(parsed.data) : null;
  } catch (error) {
    logger.warn('Failed to read create-process wizard progress', { error });
    return null;
  }
}

/**
 * Pulls saved progress back to the first unanswered question, so answers from
 * an older wizard can't land the creator past one.
 */
export function resumableProgress(saved: WizardProgress): WizardProgress {
  const answers = reconcileAnswers(saved.answers);
  const screens = screensFor(answers);
  const target = screens.includes(saved.screen)
    ? saved.screen
    : (previousScreen(saved.screen, answers) ?? 'intro');
  const screen =
    screens.find(
      (candidate) =>
        candidate === target || !isScreenComplete(candidate, answers),
    ) ?? target;

  return { screen, answers };
}
