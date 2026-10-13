import { z } from 'zod';

import { MAX_PHASES_PER_DECISION } from '../utils/phaseOrder';

export const PROCESS_NAME_MIN_LENGTH = 3;
export const PROCESS_NAME_MAX_LENGTH = 256;

export const WIZARD_PHASE_KINDS = [
  'submissions',
  'review',
  'voting',
  'results',
] as const;

export type WizardPhaseKind = (typeof WIZARD_PHASE_KINDS)[number];

export const WIZARD_PROCESS_TYPES = ['grant', 'pb', 'other'] as const;

export type WizardProcessType = (typeof WIZARD_PROCESS_TYPES)[number];

export const WIZARD_SHAPES = [
  'single',
  'loi',
  'ideas',
  'proposals',
  'custom',
  'blank',
] as const;

export type WizardShape = (typeof WIZARD_SHAPES)[number];

export const wizardPhaseDraftSchema = z.object({
  kind: z.enum(WIZARD_PHASE_KINDS),
  /** Already in the creator's language; the wizard translates its labels. */
  name: z.string().trim().min(1).max(256),
});

export type WizardPhaseDraft = z.infer<typeof wizardPhaseDraftSchema>;

export const wizardDraftSchema = z.object({
  name: z
    .string()
    .trim()
    .min(PROCESS_NAME_MIN_LENGTH)
    .max(PROCESS_NAME_MAX_LENGTH),
  type: z.enum(WIZARD_PROCESS_TYPES),
  shape: z.enum(WIZARD_SHAPES),
  phases: z.array(wizardPhaseDraftSchema).max(MAX_PHASES_PER_DECISION),
});

export type WizardDraft = z.infer<typeof wizardDraftSchema>;
