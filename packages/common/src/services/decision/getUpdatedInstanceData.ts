import type {
  DecisionInstanceData,
  InstanceOverview,
  InstanceOverviewUpdate,
  PhaseInstanceData,
  PhaseOverride,
} from './schemas/instanceData';
import type { ProcessConfig } from './schemas/types';
import type { ProposalTemplateSchema, RubricTemplateSchema } from './types';

export interface InstanceDataUpdate {
  config?: ProcessConfig;
  overview?: InstanceOverviewUpdate;
  phases?: PhaseOverride[];
  proposalTemplate?: Record<string, unknown>;
  rubricTemplate?: RubricTemplateSchema;
}

export interface PhaseEndDateChange {
  phaseId: string;
  previousEndDate: string | undefined;
  newEndDate: string;
}

export const hasNonPhaseUpdate = ({
  config,
  overview,
  proposalTemplate,
  rubricTemplate,
}: InstanceDataUpdate): boolean =>
  config !== undefined ||
  overview !== undefined ||
  proposalTemplate !== undefined ||
  rubricTemplate !== undefined;

export const hasPhaseUpdates = (
  update: InstanceDataUpdate,
): update is InstanceDataUpdate & { phases: PhaseOverride[] } =>
  update.phases !== undefined && update.phases.length > 0;

/**
 * Applies an admin update to stored instance data and the phase list without
 * touching the database. `instanceData` is set when a non-phase field
 * changes, `phases` when the update lists any; phases merge onto
 * `existingPhases`.
 */
export function getUpdatedInstanceData({
  existing,
  existingPhases,
  update,
}: {
  existing: DecisionInstanceData;
  existingPhases: PhaseInstanceData[];
  update: InstanceDataUpdate;
}): {
  instanceData?: DecisionInstanceData;
  phases?: PhaseInstanceData[];
  phaseEndDateChanges: PhaseEndDateChange[];
} {
  const { config, overview, proposalTemplate, rubricTemplate } = update;
  const phases = hasPhaseUpdates(update) ? update.phases : undefined;

  return {
    ...(hasNonPhaseUpdate(update) && {
      instanceData: {
        ...existing,
        ...(config !== undefined && {
          config: mergeConfig(existing.config, config),
        }),
        ...(overview !== undefined && {
          overview: mergeOverview(existing.overview, overview),
        }),
        // The API hands over a generic JSON Schema; the stored shape is the template type.
        ...(proposalTemplate !== undefined && {
          proposalTemplate: proposalTemplate as ProposalTemplateSchema,
        }),
        ...(rubricTemplate !== undefined && { rubricTemplate }),
      },
    }),
    ...(phases && { phases: mergePhases(existingPhases, phases) }),
    phaseEndDateChanges: phases
      ? getPhaseEndDateChanges(existingPhases, phases)
      : [],
  };
}

export function getNormalizedCategories(
  config: ProcessConfig,
): NonNullable<ProcessConfig['categories']> {
  return (config.categories ?? []).map((category) => ({
    ...category,
    label: category.label.trim(),
    description: category.description.trim(),
  }));
}

function mergeConfig(
  existing: ProcessConfig | undefined,
  config: ProcessConfig,
): ProcessConfig {
  return {
    ...existing,
    ...config,
    ...(config.categories
      ? { categories: getNormalizedCategories(config) }
      : {}),
  };
}

// `null` clears the headline; so does a legacy `''` on the stored row.
function mergeOverview(
  existing: InstanceOverview | undefined,
  overview: InstanceOverviewUpdate,
): InstanceOverview {
  const { headline, ...overviewPatch } = overview;
  const merged: InstanceOverview = {
    ...existing,
    ...overviewPatch,
    ...(typeof headline === 'string' && { headline }),
  };

  if (headline === null || isBlankHeadline(merged.headline)) {
    delete merged.headline;
  }

  return merged;
}

// Replaces the full phases array so phases can be added, removed and
// reordered. A phase that already exists keeps the data the override leaves
// out (selectionPipeline, settingsSchema, ...).
function mergePhases(
  existingPhases: PhaseInstanceData[],
  phases: PhaseOverride[],
): PhaseInstanceData[] {
  const existingById = new Map(existingPhases.map((p) => [p.phaseId, p]));

  return phases.map((phase) => {
    const merged = {
      ...existingById.get(phase.phaseId),
      phaseId: phase.phaseId,
      ...(phase.name !== undefined && { name: phase.name }),
      ...(phase.description !== undefined && {
        description: phase.description,
      }),
      ...(typeof phase.headline === 'string' && { headline: phase.headline }),
      ...(phase.additionalInfo !== undefined && {
        additionalInfo: phase.additionalInfo,
      }),
      ...(phase.rules !== undefined && { rules: phase.rules }),
      ...(phase.startDate !== undefined && { startDate: phase.startDate }),
      ...(phase.endDate !== undefined && { endDate: phase.endDate }),
      ...(phase.settings !== undefined && { settings: phase.settings }),
      ...(phase.rubricTemplate != null && {
        rubricTemplate: phase.rubricTemplate,
      }),
    };

    // `null` clears the phase rubric (falls back to the instance-level template).
    if (phase.rubricTemplate === null) {
      delete merged.rubricTemplate;
    }

    // Same for the headline, and a legacy `''` on the stored phase clears with it.
    if (phase.headline === null || isBlankHeadline(merged.headline)) {
      delete merged.headline;
    }

    return merged;
  });
}

// Only phases whose end date really changed, so the caller can emit
// `phase_end_date_changed` for committed changes alone.
function getPhaseEndDateChanges(
  existingPhases: PhaseInstanceData[],
  phases: PhaseOverride[],
): PhaseEndDateChange[] {
  const existingById = new Map(existingPhases.map((p) => [p.phaseId, p]));
  const changes: PhaseEndDateChange[] = [];

  for (const phase of phases) {
    if (phase.endDate === undefined) {
      continue;
    }

    const existing = existingById.get(phase.phaseId);

    if (existing && existing.endDate !== phase.endDate) {
      changes.push({
        phaseId: phase.phaseId,
        previousEndDate: existing.endDate,
        newEndDate: phase.endDate,
      });
    }
  }

  return changes;
}

const isBlankHeadline = (headline: string | undefined) =>
  headline?.trim() === '';
