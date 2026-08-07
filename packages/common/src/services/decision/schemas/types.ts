/**
 * Decision schema definition types.
 * Designed to work directly with RJSF.
 */
import type { UiSchema } from '@rjsf/utils';
import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';

import type { SelectionPipeline } from '../selectionPipeline/types';
import type { ProposalTemplateSchema, RubricTemplateSchema } from '../types';

/**
 * Phase behavior rules
 */
export interface PhaseRules {
  proposals?: {
    submit?: boolean;
    edit?: boolean;
    /** @deprecated Superseded by `reviews.submit`; kept only as its read fallback. */
    review?: boolean;
    defaults?: {
      hidden?: boolean;
    };
  };
  voting?: {
    submit?: boolean;
    edit?: boolean;
    /** Undefined = no limit (distinct from 0, which would block all voting). */
    maxVotesPerMember?: number;
  };
  advancement?: {
    method: 'date' | 'manual';
    endDate?: string;
  };
  /** Review enablement + settings; read via `isReviewPhase` / `getPhaseReviewSettings`. */
  reviews?: PhaseReviewSettings;
}

/**
 * A phase definition within a decision schema.
 * Each phase is a self-contained unit with its own config and optional selection pipeline.
 *
 * Phase type is inferred from position: first = initial, last = final, others = intermediate.
 */
export interface PhaseDefinition {
  id: string;
  name: string;
  description?: string;

  /** Phase behavior rules */
  rules: PhaseRules;

  /** Filter/reduce pipeline for advancing proposals to next phase */
  selectionPipeline?: SelectionPipeline;

  /** Optional per-phase settings form (use `default` in schema properties) */
  settings?: JSONSchema7 & { ui?: UiSchema };

  /** Phase-specific rubric; overrides the schema-level `rubricTemplate`. */
  rubricTemplate?: RubricTemplateSchema;
}

/**
 * Process-level configuration that applies across all phases.
 */
export interface ProposalCategory {
  id: string;
  label: string;
  description: string;
}

export const REVIEWS_POLICIES = ['full_coverage', 'single_reviewer'] as const;

export type ReviewsPolicy = (typeof REVIEWS_POLICIES)[number];

/** Coverage policy applied when neither phase rules nor legacy config set one. */
export const DEFAULT_REVIEWS_POLICY: ReviewsPolicy = 'full_coverage';

export const REVIEWS_SCOPES = ['all', 'by_category'] as const;

export type ReviewsScope = (typeof REVIEWS_SCOPES)[number];

/** Reviewer responsibility scope applied when phase rules don't set one. */
export const DEFAULT_REVIEWS_SCOPE: ReviewsScope = 'all';

/**
 * `PhaseRules.reviews` shape — single source for the interface, the API
 * encoder, and the resolved `ReviewSettings`.
 */
export const phaseReviewSettingsSchema = z.object({
  /** Enablement, like `voting.submit`. */
  submit: z.boolean().optional(),
  /**
   * What each reviewer is responsible for. Absent = `'all'` (any reviewer may
   * review any submission). `'by_category'` scopes reviewers to assigned
   * categories.
   */
  scope: z.enum(REVIEWS_SCOPES).optional(),
  /**
   * How proposals are distributed to reviewers within `scope`. Absent =
   * `'full_coverage'` (every candidate reviewer). `'single_reviewer'` assigns
   * each proposal exactly one, balanced and deterministic.
   */
  policy: z.enum(REVIEWS_POLICIES).optional(),
  allowRevisions: z.boolean().optional(),
  anonymousFeedback: z.boolean().optional(),
  /**
   * The phase's submitted reviews are open: visible to peer reviewers while
   * the phase is current, and to reviewers in later phases afterwards.
   */
  openReviews: z.boolean().optional(),
});

export type PhaseReviewSettings = z.infer<typeof phaseReviewSettingsSchema>;

export interface ProcessConfig {
  hideBudget?: boolean;
  categories?: ProposalCategory[];
  requireCategorySelection?: boolean;
  allowMultipleCategories?: boolean;
  organizeByCategories?: boolean;
  requireCollaborativeProposals?: boolean;
  isPrivate?: boolean;
  reviewsPolicy?: ReviewsPolicy;
  reviewsAllowRevisions?: boolean;
  reviewsAnonymousFeedback?: boolean;
}

/**
 * A decision schema definition - defines the phases of a decision process.
 */
export interface DecisionSchemaDefinition {
  id: string;
  /** Semantic version (e.g., "1.0.0") */
  version: string;
  name: string;
  description?: string;

  /** Process-level configuration */
  config?: ProcessConfig;

  /** Proposal template (JSON Schema) */
  proposalTemplate?: ProposalTemplateSchema;

  /** Rubric template (JSON Schema defining evaluation criteria) */
  rubricTemplate?: RubricTemplateSchema;

  /** Phase definitions */
  phases: [PhaseDefinition, ...PhaseDefinition[]];
}
