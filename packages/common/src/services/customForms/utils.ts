import { z } from 'zod';

import {
  type CustomFormCapability,
  type CustomFormShowOn,
  customFormCapabilitySchema,
} from './schemas/customForm';

/**
 * Forms written before `x-phase` existed have none, and apply to the initial
 * phase. Shared by the read path, the write check and the admin UI so they
 * cannot disagree about which phase a form belongs to.
 */
export const getEffectiveFormPhase = ({
  schema,
  initialPhaseId,
}: {
  schema: Record<string, unknown>;
  initialPhaseId?: string | null;
}): string | null => {
  const xPhase = schema['x-phase'];

  return typeof xPhase === 'string' ? xPhase : (initialPhaseId ?? null);
};

/** A form with no `x-show-on` opens after the participant's action. */
export const getFormShowOn = (
  schema: Record<string, unknown>,
): CustomFormShowOn => (schema['x-show-on'] === 'entry' ? 'entry' : 'action');

/**
 * The capabilities a participant needs to see and answer the form. Null when
 * the stored value cannot be read, so callers fail closed.
 */
export const getFormRequiredCapabilities = (
  schema: Record<string, unknown>,
): CustomFormCapability[] | null => {
  const value = schema['x-required-capabilities'];

  if (value === undefined) {
    return [];
  }

  const parsed = z.array(customFormCapabilitySchema).safeParse(value);

  return parsed.success ? parsed.data : null;
};
