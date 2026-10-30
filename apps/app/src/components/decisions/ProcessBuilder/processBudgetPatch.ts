import { isValidProcessBudget } from '@op/common/client';

export const isSavableProcessBudget = (budget: number | null): boolean =>
  budget === null || isValidProcessBudget(budget);
