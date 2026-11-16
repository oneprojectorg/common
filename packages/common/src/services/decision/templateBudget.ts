import type { ProposalTemplateSchema } from './types';

/**
 * Whether a proposal template collects a budget — i.e. has a `budget` key in
 * its `properties`. The process builder deletes the key entirely when the
 * budget toggle is switched off, so presence is the source of truth.
 */
export function templateCollectsBudget(
  template: ProposalTemplateSchema | null | undefined,
): boolean {
  return Boolean(template?.properties && 'budget' in template.properties);
}

export interface ProcessBudgetPhase {
  phaseId: string;
  settings?: Record<string, unknown> | null;
}

export function getProcessBudget({
  phases,
  currentPhaseId,
}: {
  phases: readonly ProcessBudgetPhase[] | null | undefined;
  currentPhaseId: string | null | undefined;
}): number | undefined {
  const budgets = (phases ?? []).map((phase) => ({
    phaseId: phase.phaseId,
    budget: readBudget(phase.settings),
  }));
  const current = budgets.find(
    ({ phaseId, budget }) => phaseId === currentPhaseId && budget !== undefined,
  );

  return (current ?? budgets.find(({ budget }) => budget !== undefined))
    ?.budget;
}

const readBudget = (
  settings: Record<string, unknown> | null | undefined,
): number | undefined => {
  const value = settings?.budget;
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
};
