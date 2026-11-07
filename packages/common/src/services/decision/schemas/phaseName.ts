import { z } from 'zod';

export const MAX_PHASE_NAME_LENGTH = 256;

export const PHASE_NAME_TOO_LONG = `A phase name can have at most ${MAX_PHASE_NAME_LENGTH} characters`;

export const phaseNameLengthSchema = z
  .string()
  .max(MAX_PHASE_NAME_LENGTH, PHASE_NAME_TOO_LONG);

export const phaseNameInputSchema = z
  .string()
  .trim()
  .min(1)
  .pipe(phaseNameLengthSchema);
