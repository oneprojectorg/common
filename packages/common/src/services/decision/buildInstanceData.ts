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

const CATEGORY_KEYS = [
  'categories',
  'requireCategorySelection',
  'allowMultipleCategories',
  'organizeByCategories',
] as const;

export function buildInstanceData(
  source: DecisionInstanceData,
  include: DuplicateInstanceIncludeFlags,
): DecisionInstanceData {
  const base: DecisionInstanceData = {
    templateId: source.templateId,
    templateVersion: source.templateVersion,
    templateName: source.templateName,
    templateDescription: source.templateDescription,
    phases: [],
  };

  if (include.processSettings && source.config) {
    const config: ProcessConfig = { ...source.config };

    if (!include.proposalCategories) {
      for (const key of CATEGORY_KEYS) {
        delete config[key];
      }
    }

    base.config = config;
  } else if (include.proposalCategories && source.config) {
    const config: ProcessConfig = {};
    for (const key of CATEGORY_KEYS) {
      if (source.config[key] !== undefined) {
        Object.assign(config, { [key]: source.config[key] });
      }
    }
    base.config = config;
  }

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
        // startDate and endDate intentionally omitted — duplicates start as drafts
      };

      if (include.reviewSettings) {
        copied.rules = phase.rules;
      }

      return copied;
    });
  } else if (source.phases.length > 0) {
    base.phases = source.phases.map(
      (phase): PhaseInstanceData => ({
        phaseId: phase.phaseId,
        name: phase.name,
      }),
    );
  }

  if (include.proposalTemplate && source.proposalTemplate) {
    base.proposalTemplate = source.proposalTemplate;
  }

  if (include.reviewRubric && source.rubricTemplate) {
    base.rubricTemplate = source.rubricTemplate;
  }

  return base;
}
