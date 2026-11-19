/**
 * Phase-scoped template resolution over `instanceData.phases`: a phase's own
 * template wins, else the instance-level template, else null. Structural like
 * `phaseOrder.ts`, so domain instance data and the API-encoder shape both
 * pass. Client-safe: no server-only imports.
 */
import type { RubricTemplateSchema } from '../types';

/**
 * Phase-first template resolution. An unknown or omitted `phaseId` resolves
 * to the instance-level template, so cross-phase callers and phases without
 * their own template share the instance's.
 *
 * Shared by design: per-phase `proposalTemplate` is expected to reuse this
 * with its own selector.
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
 * Instance-data shape the rubric resolvers read. Structural so the domain
 * type and the API-encoder type both satisfy it.
 */
export interface RubricInstanceData {
  rubricTemplate?: RubricTemplateSchema;
  rubricFormSchemaId?: string;
  phases?: ReadonlyArray<{
    phaseId: string;
    rubricTemplate?: RubricTemplateSchema;
    rubricFormSchemaId?: string;
  }>;
}

/**
 * The rubric template in effect for `phaseId`: the phase's own
 * `rubricTemplate` when set, else the instance-level one, else null.
 *
 * This is the *inline* copy, and stays synchronous and client-safe because
 * `@op/common/client` re-exports it. Server read paths go through
 * `resolvePhaseRubricTemplate`, which prefers the `form_schemas` head and
 * falls back to this.
 */
export function getPhaseRubricTemplate(
  instanceData: RubricInstanceData,
  phaseId: string | undefined,
): RubricTemplateSchema | null {
  return resolvePhaseTemplate(
    instanceData,
    phaseId,
    (phase) => phase.rubricTemplate,
    instanceData.rubricTemplate,
  );
}

/**
 * Which level owns the rubric for `phaseId` — the phase itself, or the
 * instance. A phase owns it as soon as it carries either half of the pair
 * (`rubricTemplate` or `rubricFormSchemaId`), so the pointer and the inline
 * copy can never be read from different levels while the dual write lasts.
 */
export function resolveRubricOwner(
  instanceData: RubricInstanceData,
  phaseId: string | undefined,
): {
  level: 'phase' | 'instance';
  template?: RubricTemplateSchema;
  formSchemaId?: string;
} {
  if (phaseId != null) {
    const phase = instanceData.phases?.find((p) => p.phaseId === phaseId);
    if (phase && (phase.rubricTemplate || phase.rubricFormSchemaId)) {
      return {
        level: 'phase',
        template: phase.rubricTemplate,
        formSchemaId: phase.rubricFormSchemaId,
      };
    }
  }
  return {
    level: 'instance',
    template: instanceData.rubricTemplate,
    formSchemaId: instanceData.rubricFormSchemaId,
  };
}

/**
 * The `form_schemas` head id for the rubric in effect for `phaseId`, read
 * from the same level `getPhaseRubricTemplate` reads the inline copy from.
 * `null` when that level has no pointer yet — `ensurePhaseRubricHead` mints
 * one lazily.
 */
export function getPhaseRubricFormSchemaId(
  instanceData: RubricInstanceData,
  phaseId: string | undefined,
): string | null {
  return resolveRubricOwner(instanceData, phaseId).formSchemaId ?? null;
}
