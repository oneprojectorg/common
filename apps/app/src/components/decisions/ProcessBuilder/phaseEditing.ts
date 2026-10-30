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

export const toPhasesPayload = (phases: readonly PhaseDefinition[]) =>
  phases.map((phase) => ({
    phaseId: phase.id,
    name: phase.name,
    description: phase.description,
    headline: phase.headline,
    additionalInfo: phase.additionalInfo,
    startDate: phase.startDate,
    endDate: phase.endDate,
    rules: phase.rules,
    ...(phase.settings !== undefined && { settings: phase.settings }),
  }));
