import { useEffect, useMemo } from 'react';

import { useProcessBuilderStore } from '../stores/useProcessBuilderStore';
import {
  type ValidationSummary,
  validateAllSteps,
} from './processBuilderValidation';

export function useProcessBuilderValidation(
  decisionProfileId: string | undefined,
): ValidationSummary {
  // Ensure the store is hydrated from localStorage so we have data to validate.
  // This is idempotent — multiple calls to rehydrate() are safe.
  useEffect(() => {
    void useProcessBuilderStore.persist.rehydrate();
  }, []);

  const instanceData = useProcessBuilderStore((state) =>
    decisionProfileId ? state.instances[decisionProfileId] : undefined,
  );

  return useMemo(() => validateAllSteps(instanceData), [instanceData]);
}
