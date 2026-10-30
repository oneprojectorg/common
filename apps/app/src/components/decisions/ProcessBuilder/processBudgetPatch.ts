import type { InstancePhaseData } from '@op/api/encoders';
import { isValidProcessBudget } from '@op/common/client';

export const toPhasesWithBudget = (
  phases: readonly InstancePhaseData[],
  budget: number | null,
): InstancePhaseData[] | undefined => {
  const [first, ...rest] = phases;
  if (!first) {
    return undefined;
  }

  const { budget: _previous, ...settings } = first.settings ?? {};

  return [
    {
      ...first,
      settings: budget === null ? settings : { ...settings, budget },
    },
    ...rest,
  ];
};

export const isSavableProcessBudget = (budget: number | null): boolean =>
  budget === null || isValidProcessBudget(budget);
