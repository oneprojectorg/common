/**
 * Phase-scoped template resolution over a phase list: a phase's own template
 * wins, else the instance-level template, else null. Structural like
 * `phaseOrder.ts`: the server passes resolved phases plus the instance-level
 * template, the client its wire `instanceData`. Client-safe: no server-only
 * imports.
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
  source: { phases?: readonly Phase[] },
  phaseId: string | undefined,
  selectPhaseTemplate: (phase: Phase) => Template | undefined,
  instanceTemplate: Template | undefined,
): Template | null {
  if (phaseId != null) {
    const phase = source.phases?.find((p) => p.phaseId === phaseId);
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
  source: {
    rubricTemplate?: RubricTemplateSchema;
    phases?: ReadonlyArray<{
      phaseId: string;
      rubricTemplate?: RubricTemplateSchema;
    }>;
  },
  phaseId: string | undefined,
): RubricTemplateSchema | null {
  return resolvePhaseTemplate(
    source,
    phaseId,
    (phase) => phase.rubricTemplate,
    source.rubricTemplate,
  );
}

export function getPhaseProposalTemplate(
  source: {
    proposalTemplate?: ProposalTemplateSchema;
    phases?: ReadonlyArray<{
      phaseId: string;
      proposalTemplate?: ProposalTemplateSchema;
    }>;
  },
  phaseId: string | undefined,
): ProposalTemplateSchema | null {
  return resolvePhaseTemplate(
    source,
    phaseId,
    (phase) => phase.proposalTemplate,
    source.proposalTemplate,
  );
}
