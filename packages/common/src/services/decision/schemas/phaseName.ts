import { z } from 'zod';

// The phase profile's `varchar(256)` name column, which counts code points.
export const MAX_PHASE_NAME_LENGTH = 256;

// `String.length` counts UTF-16 units, so an astral character counts twice.
export const isPhaseNameTooLong = (name: string): boolean =>
  [...name].length > MAX_PHASE_NAME_LENGTH;

export const phaseNameLengthSchema = z
  .string()
  .refine((name) => !isPhaseNameTooLong(name), {
    message: `A phase name can have at most ${MAX_PHASE_NAME_LENGTH} characters`,
  });
