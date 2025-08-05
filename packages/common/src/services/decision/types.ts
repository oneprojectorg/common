import type { JSONSchema7 } from 'json-schema';

// Base JSON Schema type (more specific than any)
export type JsonSchema = JSONSchema7;

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
  type: 'time' | 'proposalCount' | 'participationCount' | 'approvalRate' | 'customField';
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
  fieldValues?: Record<string, unknown>; // Values for process fields schema
  currentStateId: string;
  stateData?: Record<string, StateData>; // State-specific runtime data
  phases?: PhaseConfiguration[];
}

export interface StateData {
  enteredAt?: string;
  metadata?: Record<string, unknown>;
}

export interface PhaseConfiguration {
  stateId: string;
  actualStartDate?: string;
  actualEndDate?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
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
  type: 'date' | 'proposal_count' | 'decision_threshold' | 'custom_field' | 'manual_approval';
  condition: RuleCondition;
  errorMessage?: string;
}

export interface RuleCondition {
  operator: 'equals' | 'greater_than' | 'less_than' | 'greater_equal' | 'less_equal' | 'contains' | 'exists';
  value?: unknown;
  field?: string; // For custom field rules
}

// Proposal Data Structure
export interface ProposalData {
  // Proposal content should match the proposalTemplate schema
  [key: string]: unknown;
}

// Decision Data Structure  
export interface DecisionData {
  // Decision content should match the decisionDefinition schema
  [key: string]: unknown;
}