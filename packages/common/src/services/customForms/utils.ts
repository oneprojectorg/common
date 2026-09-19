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
