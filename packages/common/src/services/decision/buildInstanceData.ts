import type {
  DecisionInstanceData,
  PhaseInstanceData,
} from './schemas/instanceData';
import type { ProcessConfig } from './schemas/types';

export type DuplicateInstanceIncludeFlags = {
  processSettings: boolean;
  phases: boolean;
  proposalCategories: boolean;
  proposalTemplate: boolean;
  reviewSettings: boolean;
  reviewRubric: boolean;
  roles: boolean;
};

/** Category-related config keys */
const CATEGORY_KEYS = [
  'categories',
  'requireCategorySelection',
  'allowMultipleCategories',
  'organizeByCategories',
] as const;

/**
 * Builds the new instance data by selectively copying from the source
 * based on include flags.
 */
export function buildInstanceData(
  source: DecisionInstanceData,
  include: DuplicateInstanceIncludeFlags,
): DecisionInstanceData {
  // Always copy template reference metadata
  const base: DecisionInstanceData = {
    templateId: source.templateId,
    templateVersion: source.templateVersion,
    templateName: source.templateName,
    templateDescription: source.templateDescription,
    phases: [],
  };

  // Process settings (config minus category fields unless proposalCategories is also included)
  if (include.processSettings && source.config) {
    const config: ProcessConfig = { ...source.config };

    if (!include.proposalCategories) {
      // Strip category-related fields from config
      for (const key of CATEGORY_KEYS) {
        delete config[key];
      }
    }

    base.config = config;
  } else if (include.proposalCategories && source.config) {
    // Only category fields from config
    const config: ProcessConfig = {};
    for (const key of CATEGORY_KEYS) {
      if (source.config[key] !== undefined) {
        (config as any)[key] = source.config[key];
      }
    }
    base.config = config;
  }

  // Phases
  if (include.phases && source.phases.length > 0) {
    base.phases = source.phases.map((phase): PhaseInstanceData => {
      const copied: PhaseInstanceData = {
        phaseId: phase.phaseId,
        name: phase.name,
        description: phase.description,
        headline: phase.headline,
        additionalInfo: phase.additionalInfo,
        settingsSchema: phase.settingsSchema,
        settings: phase.settings,
        selectionPipeline: phase.selectionPipeline,
        // Strip dates
        // startDate and endDate intentionally omitted
      };

      // Include review settings (phase-level rules) if requested
      if (include.reviewSettings) {
        copied.rules = phase.rules;
      }

      return copied;
    });
  } else if (source.phases.length > 0) {
    // Even without phase details, we need at least minimal phase references
    base.phases = source.phases.map(
      (phase): PhaseInstanceData => ({
        phaseId: phase.phaseId,
        name: phase.name,
        // Minimal phase - just identity
      }),
    );
  }

  // Proposal template
  if (include.proposalTemplate && source.proposalTemplate) {
    base.proposalTemplate = source.proposalTemplate;
  }

  // Review rubric
  if (include.reviewRubric && source.rubricTemplate) {
    base.rubricTemplate = source.rubricTemplate;
  }

  return base;
}
