/**
 * Phase-scoped template resolution over `instanceData.phases`: a phase's own
 * template wins, else the instance-level template, else null. Structural like
 * `phaseOrder.ts`, so domain instance data and the API-encoder shape both
 * pass. Client-safe: no server-only imports.
 */
import type { ProposalTemplateSchema, RubricTemplateSchema } from '../types';

/**
 * Phase-first template resolution. An unknown or omitted `phaseId` resolves
 * to the instance-level template, so cross-phase callers and phases without
 * their own template share the instance's.
 */
export function resolvePhaseTemplate<
  Template,
  Phase extends { phaseId: string },
>(
  instanceData: { phases?: readonly Phase[] },
  phaseId: string | undefined,
  selectPhaseTemplate: (phase: Phase) => Template | undefined,
  instanceTemplate: Template | undefined,
): Template | null {
  if (phaseId != null) {
    const phase = instanceData.phases?.find((p) => p.phaseId === phaseId);
    const phaseTemplate = phase ? selectPhaseTemplate(phase) : undefined;
    if (phaseTemplate !== undefined) {
      return phaseTemplate;
    }
  }
  return instanceTemplate ?? null;
}

/**
 * The rubric template in effect for `phaseId`: the phase's own
 * `rubricTemplate` when set, else the instance-level one, else null. Every
 * review read/write path resolves its rubric through here — reviews are
 * always interpreted against the rubric of the phase they belong to.
 */
export function getPhaseRubricTemplate(
  instanceData: {
    rubricTemplate?: RubricTemplateSchema;
    phases?: ReadonlyArray<{
      phaseId: string;
      rubricTemplate?: RubricTemplateSchema;
    }>;
  },
  phaseId: string | undefined,
): RubricTemplateSchema | null {
  return resolvePhaseTemplate(
    instanceData,
    phaseId,
    (phase) => phase.rubricTemplate,
    instanceData.rubricTemplate,
  );
}

/** The proposal form in effect for `phaseId`, resolved like the rubric. */
export function getPhaseProposalTemplate(
  instanceData: {
    proposalTemplate?: ProposalTemplateSchema;
    phases?: ReadonlyArray<{
      phaseId: string;
      proposalTemplate?: ProposalTemplateSchema;
    }>;
  },
  phaseId: string | undefined,
): ProposalTemplateSchema | null {
  return resolvePhaseTemplate(
    instanceData,
    phaseId,
    (phase) => phase.proposalTemplate,
    instanceData.proposalTemplate,
  );
}
