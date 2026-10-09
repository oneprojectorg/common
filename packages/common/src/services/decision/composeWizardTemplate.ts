import { CommonError, ValidationError } from '../../utils';
import { simpleVoting } from './schemas/definitions';
import type { DecisionInstanceData } from './schemas/instanceData';
import type {
  DecisionSchemaDefinition,
  PhaseDefinition,
  PhaseRules,
  ProcessConfig,
} from './schemas/types';

export const WIZARD_PHASE_KINDS = [
  'submissions',
  'review',
  'voting',
  'results',
] as const;

export type WizardPhaseKind = (typeof WIZARD_PHASE_KINDS)[number];

export const WIZARD_PROCESS_TYPES = ['grant', 'pb', 'other'] as const;

export type WizardProcessType = (typeof WIZARD_PROCESS_TYPES)[number];

export interface WizardPhaseDraft {
  kind: WizardPhaseKind;
  /** Already in the creator's language; the wizard translates its labels. */
  name: string;
}

export interface WizardDraft {
  name: string;
  type: WizardProcessType;
  shape: string;
  phases: WizardPhaseDraft[];
}

export const WIZARD_TEMPLATE_VERSION = '1.0.0';

const RULES_BY_KIND: Record<WizardPhaseKind, PhaseRules> = {
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

// The seeded template's phases carry each kind's settings form and pipeline.
const SEEDED_PHASE_BY_KIND: Record<WizardPhaseKind, string> = {
  submissions: 'submission',
  review: 'review',
  voting: 'voting',
  results: 'results',
};

/** A template for the wizard's answers; the wizard needs no row of its own. */
export function composeWizardTemplate(
  draft: WizardDraft,
): DecisionSchemaDefinition {
  const ids = uniquePhaseIds(draft.phases);
  const last = draft.phases.length - 1;
  const [head, ...tail] = draft.phases.map((phase, index) =>
    composePhase({
      ...phase,
      id: ids[index] ?? phase.kind,
      isLast: index === last,
    }),
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
export function blankWizardInstanceData(
  draft: WizardDraft,
): DecisionInstanceData {
  const { id, version, name, config, proposalTemplate } = processLevel(draft);

  return {
    templateId: id,
    templateVersion: version,
    templateName: name,
    config,
    proposalTemplate,
    phases: [],
  };
}

export const wizardTemplateId = ({
  type,
  shape,
}: Pick<WizardDraft, 'type' | 'shape'>): string => `wizard:${type}:${shape}`;

function processLevel(draft: WizardDraft) {
  const config: ProcessConfig = { hideBudget: draft.type === 'other' };

  return {
    id: wizardTemplateId(draft),
    version: WIZARD_TEMPLATE_VERSION,
    name: draft.name,
    config,
    proposalTemplate: simpleVoting.proposalTemplate,
  };
}

function composePhase({
  kind,
  name,
  id,
  isLast,
}: WizardPhaseDraft & { id: string; isLast: boolean }): PhaseDefinition {
  const seeded = seededPhase(kind);

  return {
    id,
    name,
    rules: RULES_BY_KIND[kind],
    ...(seeded.settings && { settings: seeded.settings }),
    // Nothing advances out of the last phase.
    ...(!isLast &&
      seeded.selectionPipeline && {
        selectionPipeline: seeded.selectionPipeline,
      }),
  };
}

function seededPhase(kind: WizardPhaseKind): PhaseDefinition {
  const seededId = SEEDED_PHASE_BY_KIND[kind];
  const phase = simpleVoting.phases.find(
    (candidate) => candidate.id === seededId,
  );

  if (!phase) {
    throw new CommonError(`The seeded template has no "${seededId}" phase`);
  }

  return phase;
}

// A kind can repeat (ideas, then built-up proposals), and ids must not.
function uniquePhaseIds(phases: readonly WizardPhaseDraft[]): string[] {
  const seen = new Map<WizardPhaseKind, number>();

  return phases.map(({ kind }) => {
    const count = (seen.get(kind) ?? 0) + 1;
    seen.set(kind, count);

    return count === 1 ? kind : `${kind}-${count}`;
  });
}
