import type { CustomFormDefinitionSchema } from './schemas/customForm';

/**
 * The decision phase a stored form applies to: its `x-phase` when present, else
 * the process's initial phase (so legacy forms written before `x-phase` existed
 * keep gating the submission phase).
 *
 * The single definition of that rule — the read path, the duplicate check on
 * write, and the admin UI all resolve a form's phase through here, so they
 * cannot drift into disagreeing about which phase a form belongs to.
 */
export const getEffectiveFormPhase = ({
  schema,
  initialPhaseId,
}: {
  schema: Record<string, unknown>;
  initialPhaseId?: string | null;
}): string | null => {
  // Single cast point at the DB boundary: the jsonb column holds the same JSON
  // Schema dialect proposal templates use.
  const xPhase = (schema as CustomFormDefinitionSchema)['x-phase'];

  return xPhase ?? initialPhaseId ?? null;
};
