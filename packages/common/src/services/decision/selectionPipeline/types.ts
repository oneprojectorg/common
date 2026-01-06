import type { ProcessInstance, Proposal } from '@op/db/schema';

import type { DecisionInstanceData } from '../../../lib/decisionSchemas/instanceData';
import type { DecisionSchemaDefinition } from '../../../lib/decisionSchemas/types';
import type { InstanceData, ProcessSchema } from '../types';

/**
 * Top-level selection pipeline definition
 */
export interface SelectionPipeline {
  version: string; // e.g., "1.0.0"
  blocks: Block[];
  output?: string; // which variable holds the final result (default: last block output)
  variables?: Record<string, any>; // initial variables
}

/**
 * Block types that can be used in the pipeline
 */
export type Block =
  | FilterBlock
  | TransformBlock
  | ComputeBlock
  | BranchBlock
  | MergeBlock
  | GroupBlock
  | LimitBlock
  | SortBlock
  | ScoreBlock
  | DebugBlock;

/**
 * Base block interface
 */
export interface BaseBlock {
  id: string; // unique identifier for this block
  name?: string; // human-readable name
  description?: string; // documentation
  input?: string; // variable name to read from (default: output of previous block)
  output?: string; // variable name to write to (default: auto-generated)
}

/**
 * Filter block - removes proposals that don't match conditions
 */
export interface FilterBlock extends BaseBlock {
  type: 'filter';
  condition: Expression; // boolean expression
}

/**
 * Transform block - modifies proposal data or metadata
 */
export interface TransformBlock extends BaseBlock {
  type: 'transform';
  transformations: {
    [fieldPath: string]: Expression; // computed value expression
  };
}

/**
 * Compute block - calculates values and stores in variables
 */
export interface ComputeBlock extends BaseBlock {
  type: 'compute';
  computations: {
    [variableName: string]: Expression;
  };
}

/**
 * Branch block - conditional execution paths
 */
export interface BranchBlock extends BaseBlock {
  type: 'branch';
  branches: Array<{
    condition: Expression;
    blocks: Block[]; // nested pipeline
    output?: string; // where this branch stores its output
  }>;
  default?: {
    blocks: Block[];
    output?: string;
  };
}

/**
 * Merge block - combines multiple inputs
 */
export interface MergeBlock extends BaseBlock {
  type: 'merge';
  inputs: string[]; // variable names to merge
  strategy: 'union' | 'intersection' | 'concat' | 'custom';
  customMerge?: Expression; // for custom strategy
}

/**
 * Group block - groups proposals by field
 */
export interface GroupBlock extends BaseBlock {
  type: 'group';
  groupBy: string | Expression; // field path or expression
  aggregations?: {
    [fieldName: string]: {
      operation: 'count' | 'sum' | 'avg' | 'min' | 'max';
      field?: string; // field to aggregate (not needed for count)
    };
  };
}

/**
 * Limit block - take first N proposals
 */
export interface LimitBlock extends BaseBlock {
  type: 'limit';
  count: number | Expression; // can be computed dynamically
  offset?: number | Expression;
}

/**
 * Sort block - order proposals
 */
export interface SortBlock extends BaseBlock {
  type: 'sort';
  sortBy: Array<{
    field: string | Expression;
    order: 'asc' | 'desc';
    nullsFirst?: boolean;
  }>;
}

/**
 * Score block - calculate composite scores
 */
export interface ScoreBlock extends BaseBlock {
  type: 'score';
  scoreField: string; // where to store the score (e.g., "metadata.finalScore")
  formula: Expression | ScoringCriteria[];
}

export interface ScoringCriteria {
  field?: string | Expression;
  expression?: Expression;
  weight: number;
  normalize?: boolean; // normalize to 0-1 range
  invert?: boolean; // invert the value (useful for "fewer is better")
}

/**
 * Debug block - log intermediate state
 */
export interface DebugBlock extends BaseBlock {
  type: 'debug';
  message?: string;
  logFields?: string[]; // specific fields to log
}

/**
 * Expression system for conditions and computations
 */
export type Expression =
  | FieldAccessExpression
  | ComparisonExpression
  | LogicalExpression
  | ArithmeticExpression
  | FunctionCallExpression
  | LiteralExpression
  | VariableExpression;

/**
 * Access a field on the proposal or context
 */
export interface FieldAccessExpression {
  field: string; // dot notation, e.g., "proposalData.title", "voteData.approvalRate"
}

/**
 * Compare two values
 */
export interface ComparisonExpression {
  operator:
    | 'equals'
    | 'notEquals'
    | 'greaterThan'
    | 'lessThan'
    | 'greaterThanOrEquals'
    | 'lessThanOrEquals'
    | 'in'
    | 'notIn'
    | 'contains'
    | 'startsWith'
    | 'endsWith'
    | 'matches'; // regex
  left: Expression;
  right: Expression;
}

/**
 * Logical operators
 */
export interface LogicalExpression {
  and?: Expression[];
  or?: Expression[];
  not?: Expression;
}

/**
 * Arithmetic operations
 */
export interface ArithmeticExpression {
  operator: 'add' | 'subtract' | 'multiply' | 'divide' | 'modulo' | 'power';
  operands: Expression[];
}

/**
 * Function calls
 */
export interface FunctionCallExpression {
  function: string; // e.g., "sum", "avg", "count", "coalesce", "if"
  arguments: Expression[];
}

/**
 * Literal value
 */
export interface LiteralExpression {
  value: any; // number, string, boolean, null, array, object
}

/**
 * Variable reference
 */
export interface VariableExpression {
  variable: string; // e.g., "$threshold", "$categoryWeight"
}

/**
 * Execution context for pipeline evaluation
 */
export interface ExecutionContext {
  // Input proposals
  proposals: Proposal[];

  // Current proposal (when evaluating expressions on individual proposals)
  proposal?: Proposal;

  // Voting data aggregated per proposal
  voteData?: {
    [proposalId: string]: VoteAggregation;
  };

  // Process instance data
  process: {
    instanceId: string;
    processId: string;
    currentStateId: string | null;
    instanceData: InstanceData | DecisionInstanceData;
    processSchema: ProcessSchema | DecisionSchemaDefinition;
    processInstance: ProcessInstance;
  };

  // Variables from compute blocks and pipeline initialization
  variables: Record<string, any>;

  // Intermediate block outputs
  outputs: Record<string, any>;
}

/**
 * Aggregated voting data for a single proposal
 */
export interface VoteAggregation {
  proposalId: string;
  likesCount: number;
  followsCount: number;
  voteCount: number; // Total votes from decision making
  approvalCount: number; // For decision votes
  rejectionCount: number; // For decision votes
  abstainCount: number; // For decision votes
  approvalRate: number; // approvalCount / voteCount
  participationRate?: number; // voteCount / totalEligibleVoters
  votes: any[]; // Raw vote records
  // Additional custom metrics can be added here
}

/**
 * Result of executing a block
 */
export interface BlockExecutionResult {
  proposals: Proposal[];
  variables?: Record<string, any>; // Variables set by this block
  output?: any; // Output value (for non-proposal-returning blocks)
}

/**
 * Block executor interface
 */
export interface BlockExecutor<T extends Block = Block> {
  execute(
    block: T,
    context: ExecutionContext,
  ): Promise<BlockExecutionResult> | BlockExecutionResult;
}
