import type { JSONSchema7 } from 'json-schema';

import type { SelectionPipeline } from './selectionPipeline/types';

// Base JSON Schema type (more specific than any)
export type JsonSchema = JSONSchema7;

// ---------------------------------------------------------------------------
// Proposal template vendor extensions
// ---------------------------------------------------------------------------

/**
 * Supported values for the `x-format` vendor extension on proposal template
 * properties. Describes **how** a field should be presented/coerced, while
 * JSON Schema keywords (`type`, `enum`, etc.) describe the data shape.
 */
export type XFormat = 'short-text' | 'long-text' | 'money' | 'dropdown';

/** JSON Schema 7 property extended with `x-format` vendor extension. */
export interface XFormatPropertySchema extends JSONSchema7 {
  'x-format'?: XFormat;
}

/** JSON Schema 7 extended with proposal template vendor extensions. */
export interface ProposalTemplateSchema extends JSONSchema7 {
  [key: string]: unknown;
  properties?: Record<string, XFormatPropertySchema>;
  'x-field-order'?: string[];
}

// ---------------------------------------------------------------------------
// Rubric template types
// ---------------------------------------------------------------------------

/** JSON Schema 7 extended with rubric template vendor extensions. */
export interface RubricTemplateSchema extends JSONSchema7 {
  [key: string]: unknown;
  properties?: Record<string, XFormatPropertySchema>;
  'x-field-order'?: string[];
}

// Process Schema Structure
export interface ProcessSchema {
  // Basic info
  name: string;
  description?: string;
  budget?: number;

  // Fields shown to users (JSON Schema)
  fields?: JsonSchema;

  // State machine definition
  states: StateDefinition[];
  transitions: TransitionDefinition[];
  initialState: string;

  // Decision/voting definition (JSON Schema)
  decisionDefinition: JsonSchema;

  // Template for proposals (JSON Schema)
  proposalTemplate: JsonSchema;

  // Selection pipeline for results phase
  selectionPipeline?: SelectionPipeline;

  // Phase transition pipelines (keyed by state ID)
  phaseTransitionPipelines?: Record<string, SelectionPipeline>;
}

// State Definition (stored in processSchema.states)
export interface StateDefinition {
  id: string;
  name: string;
  description?: string;

  // State-specific fields (JSON Schema)
  fields?: JsonSchema;

  // Phase timing (for linear processes)
  phase?: {
    startDate?: string;
    endDate?: string;
    sortOrder?: number;
  };

  // State type
  type?: 'initial' | 'intermediate' | 'final';

  // State-specific configuration
  config?: {
    allowProposals?: boolean;
    allowDecisions?: boolean;
    visibleComponents?: string[];
  };
}

// Transition Definition (stored in processSchema.transitions)
export interface TransitionDefinition {
  id: string;
  name: string;
  from: string | string[];
  to: string;

  // Transition rules
  rules?: {
    type: 'manual' | 'automatic';
    conditions?: TransitionCondition[];
    requireAll?: boolean; // AND vs OR
  };

  // Actions on transition
  actions?: TransitionAction[];
}

export interface TransitionCondition {
  type:
    | 'time'
    | 'proposalCount'
    | 'participationCount'
    | 'approvalRate'
    | 'customField';
  operator: 'equals' | 'greaterThan' | 'lessThan' | 'between';
  value?: unknown;
  field?: string; // For customField type
}

export interface TransitionAction {
  type: 'notify' | 'updateField' | 'createRecord';
  config: Record<string, unknown>;
}

// Instance Data Structure
export interface InstanceData {
  budget?: number;
  hideBudget?: boolean; // Whether to hide the budget from non-owners
  fieldValues?: Record<string, unknown>; // Values for process fields schema
  currentPhaseId: string;
  stateData?: Record<string, StateData>; // State-specific runtime data
  phases?: PhaseConfiguration[];
}

export interface StateData {
  enteredAt?: string;
  metadata?: Record<string, unknown>;
}

export interface PhaseConfiguration {
  phaseId: string;
  startDate?: string;
  endDate?: string;
}

// Phase Transition Rules
export interface PhaseTransitionRules {
  // Rules that must be met to transition TO this phase
  entryRules?: TransitionRule[];

  // Rules that must be met to transition FROM this phase to the next
  exitRules?: TransitionRule[];

  // Auto-transition settings
  autoTransition?: {
    enabled: boolean;
    checkInterval?: number; // minutes
  };
}

export interface TransitionRule {
  id: string;
  type:
    | 'date'
    | 'proposal_count'
    | 'decision_threshold'
    | 'custom_field'
    | 'manual_approval';
  condition: RuleCondition;
  errorMessage?: string;
}

export interface RuleCondition {
  operator:
    | 'equals'
    | 'greater_than'
    | 'less_than'
    | 'greater_equal'
    | 'less_equal'
    | 'contains'
    | 'exists';
  value?: unknown;
  field?: string; // For custom field rules
}

// Decision Data Structure
export interface DecisionData {
  // Decision content should match the decisionDefinition schema
  [key: string]: unknown;
}
