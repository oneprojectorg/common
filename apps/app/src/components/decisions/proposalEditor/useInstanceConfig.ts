import { trpc } from '@op/api/client';
import type { ProcessInstance } from '@op/api/encoders';
import { useMemo } from 'react';

/**
 * Extracts budget cap, required-field flags, and categories from
 * instance phase settings and the stored proposal template.
 */
export function useInstanceConfig(instance: ProcessInstance) {
  const [categoriesData] = trpc.decision.getCategories.useSuspenseQuery({
    processInstanceId: instance.id,
  });
  const { categories } = categoriesData;

  const { budgetCapAmount, isBudgetRequired, isCategoryRequired } =
    useMemo(() => {
      let cap: number | undefined;
      let budgetRequired = true;
      let categoryRequired = true;

      const currentPhaseId = instance.instanceData?.currentPhaseId;
      const currentPhaseData = instance.instanceData?.phases?.find(
        (p) => p.phaseId === currentPhaseId,
      );
      const phaseBudget = currentPhaseData?.settings?.budget as
        | number
        | undefined;

      if (phaseBudget != null) {
        return {
          budgetCapAmount: phaseBudget,
          isBudgetRequired: budgetRequired,
          isCategoryRequired: categoryRequired,
        };
      }

      const proposalTemplate =
        instance.process?.processSchema?.proposalTemplate;
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
            cap = budgetProp.maximum as number;
          }
        }

        if (
          'required' in proposalTemplate &&
          Array.isArray(proposalTemplate.required)
        ) {
          budgetRequired = proposalTemplate.required.includes('budget');
          categoryRequired = proposalTemplate.required.includes('category');
        }
      }

      if (!cap && instance.instanceData?.fieldValues?.budgetCapAmount) {
        cap = instance.instanceData.fieldValues.budgetCapAmount as number;
      }

      return {
        budgetCapAmount: cap,
        isBudgetRequired: budgetRequired,
        isCategoryRequired: categoryRequired,
      };
    }, [instance]);

  return { categories, budgetCapAmount, isBudgetRequired, isCategoryRequired };
}
