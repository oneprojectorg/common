import { z } from 'zod';

export const MAX_PHASE_NAME_LENGTH = 256;

export const phaseNameLengthSchema = z
  .string()
  .max(
    MAX_PHASE_NAME_LENGTH,
    `A phase name can have at most ${MAX_PHASE_NAME_LENGTH} characters`,
  );

export const phaseNameInputSchema = z
  .string()
  .trim()
  .min(1)
  .pipe(phaseNameLengthSchema);
