import type { InstancePhaseData, PhaseDefinition } from '@op/api/encoders';

export type PhaseSource = Pick<
  InstancePhaseData,
  | 'phaseId'
  | 'name'
  | 'description'
  | 'headline'
  | 'additionalInfo'
  | 'rules'
  | 'startDate'
  | 'endDate'
  | 'settings'
>;

export const toEditablePhases = (
  phases: readonly PhaseSource[],
): PhaseDefinition[] =>
  phases.map((phase) => ({
    id: phase.phaseId,
    name: phase.name ?? '',
    description: phase.description,
    headline: phase.headline,
    additionalInfo: phase.additionalInfo,
    rules: phase.rules ?? {},
    startDate: phase.startDate,
    endDate: phase.endDate,
    ...(phase.settings !== undefined && { settings: phase.settings }),
  }));

export const toPhasesPayload = (
  phases: readonly PhaseDefinition[],
  snapshotPhases: readonly PhaseSource[] | undefined,
) => {
  const snapshotSettings = new Map(
    (snapshotPhases ?? []).map((phase) => [phase.phaseId, phase.settings]),
  );
  return phases.map((phase) => ({
    phaseId: phase.id,
    name: phase.name,
    description: phase.description,
    headline: phase.headline,
    additionalInfo: phase.additionalInfo,
    startDate: phase.startDate,
    endDate: phase.endDate,
    rules: phase.rules,
    ...(phase.settings !== undefined &&
      !sameValue(phase.settings, snapshotSettings.get(phase.id)) && {
        settings: phase.settings,
      }),
  }));
};

const sameValue = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => sameValue(item, b[index]))
    );
  }
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  ) {
    return false;
  }
  const aEntries = Object.entries(a);
  return (
    aEntries.length === Object.keys(b).length &&
    aEntries.every(([key, value]) =>
      sameValue(value, (b as Record<string, unknown>)[key]),
    )
  );
};
