import { trpc } from '@op/api/client';
import type { ProcessInstance } from '@op/api/encoders';
import { useMemo } from 'react';

/**
 * Extracts the budget cap and categories from instance phase settings
 * and the stored proposal template.
 *
 * Required-field logic is intentionally omitted — the proposal template
 * schema (via its `required` array) is the single source of truth for
 * which fields are mandatory.
 */
export function useInstanceConfig(instance: ProcessInstance) {
  const [categoriesData] = trpc.decision.getCategories.useSuspenseQuery({
    processInstanceId: instance.id,
  });
  const { categories } = categoriesData;

  const budgetCapAmount = useMemo(() => {
    // 1. Phase-level budget takes precedence.
    const currentPhaseId = instance.instanceData?.currentPhaseId;
    const currentPhaseData = instance.instanceData?.phases?.find(
      (p) => p.phaseId === currentPhaseId,
    );
    const phaseBudget = currentPhaseData?.settings?.budget as
      | number
      | undefined;

    if (phaseBudget != null) {
      return phaseBudget;
    }

    // 2. Template-level budget maximum.
    const proposalTemplate = instance.process?.processSchema?.proposalTemplate;
    if (
      proposalTemplate &&
      typeof proposalTemplate === 'object' &&
      'properties' in proposalTemplate
    ) {
      const properties = proposalTemplate.properties;
      if (
        properties &&
        typeof properties === 'object' &&
        'budget' in properties
      ) {
        const budgetProp = properties.budget;
        if (
          budgetProp &&
          typeof budgetProp === 'object' &&
          'maximum' in budgetProp
        ) {
          return budgetProp.maximum as number;
        }
      }
    }

    // 3. Legacy fieldValues fallback.
    if (instance.instanceData?.fieldValues?.budgetCapAmount) {
      return instance.instanceData.fieldValues.budgetCapAmount as number;
    }

    return undefined;
  }, [instance]);

  return { categories, budgetCapAmount };
}
