import { ValidationError } from '../../utils';
import type {
  CreateInstanceInput,
  InstancePhaseInput,
  PhaseKind,
  ProcessType,
} from './schemas/createInstance';
import type { DecisionInstanceData } from './schemas/instanceData';
import type {
  DecisionSchemaDefinition,
  PhaseDefinition,
  PhaseRules,
  ProcessConfig,
} from './schemas/types';
import type { SelectionPipeline } from './selectionPipeline/types';

export const COMPOSED_TEMPLATE_VERSION = '1.0.0';

// Platform admin shows the template name as the process type.
const TYPE_LABEL: Record<ProcessType, string> = {
  grant: 'Grant',
  pb: 'Participatory budgeting',
  other: 'Custom',
};

const RULES_BY_KIND: Record<PhaseKind, PhaseRules> = {
  submissions: {
    proposals: { submit: true, edit: true },
    voting: { submit: false },
    advancement: { method: 'manual' },
  },
  review: {
    proposals: { submit: false },
    reviews: { submit: true },
    voting: { submit: false },
    advancement: { method: 'manual' },
  },
  voting: {
    proposals: { submit: false },
    voting: { submit: true },
    advancement: { method: 'manual' },
  },
  results: {
    proposals: { submit: false },
    voting: { submit: false },
    advancement: { method: 'manual' },
  },
};

// Without a pipeline nothing carries over, and an admin picks what does.
const PIPELINE_BY_KIND: Record<PhaseKind, SelectionPipeline | undefined> = {
  submissions: { version: '1.0.0', blocks: [] },
  review: undefined,
  voting: undefined,
  results: undefined,
};

export function composeInstanceTemplate(
  draft: CreateInstanceInput,
): DecisionSchemaDefinition {
  const last = draft.phases.length - 1;
  const [head, ...tail] = withUniqueIds(draft.phases).map((phase, index) =>
    composePhase({ ...phase, isLast: index === last }),
  );

  if (!head) {
    throw new ValidationError('A process needs at least one phase', {
      phases: 'Add a phase',
    });
  }

  return {
    ...processLevel(draft),
    phases: [head, ...tail],
  };
}

/** The "start from scratch" choice: no phases until the admin adds one. */
export function blankInstanceData(
  draft: CreateInstanceInput,
): DecisionInstanceData {
  const { id, version, name, config } = processLevel(draft);

  return {
    templateId: id,
    templateVersion: version,
    templateName: name,
    config,
    phases: [],
  };
}

export const composedTemplateId = ({
  type,
}: Pick<CreateInstanceInput, 'type'>): string => `composed:${type}`;

function processLevel(draft: CreateInstanceInput) {
  const config: ProcessConfig = { hideBudget: draft.type === 'other' };

  return {
    id: composedTemplateId(draft),
    version: COMPOSED_TEMPLATE_VERSION,
    name: TYPE_LABEL[draft.type],
    config,
  };
}

function composePhase({
  kind,
  name,
  id,
  isLast,
}: InstancePhaseInput & { id: string; isLast: boolean }): PhaseDefinition {
  const selectionPipeline = PIPELINE_BY_KIND[kind];

  return {
    id,
    name,
    rules: RULES_BY_KIND[kind],
    // Nothing advances out of the last phase.
    ...(!isLast && selectionPipeline && { selectionPipeline }),
  };
}

// A kind can repeat (ideas, then built-up proposals), and ids must not.
function withUniqueIds(
  phases: readonly InstancePhaseInput[],
): Array<InstancePhaseInput & { id: string }> {
  const seen = new Map<PhaseKind, number>();

  return phases.map((phase) => {
    const count = (seen.get(phase.kind) ?? 0) + 1;
    seen.set(phase.kind, count);

    return {
      ...phase,
      id: count === 1 ? phase.kind : `${phase.kind}-${count}`,
    };
  });
}
