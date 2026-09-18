/**
 * The decision phase a stored form applies to: its `x-phase` when present, else
 * the process's initial phase (so legacy forms written before `x-phase` existed
 * keep gating the submission phase).
 *
 * The single definition of that rule — the read path, the duplicate check on
 * write, and the admin UI all resolve a form's phase through here, so they
 * cannot drift into disagreeing about which phase a form belongs to.
 *
 * `schema` is raw jsonb, so a non-string `x-phase` is possible in principle and
 * falls back rather than being trusted as a phase id.
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
