import { useMemo } from 'react';

import { useProcessBuilderStore } from '../stores/useProcessBuilderStore';
import {
  type ValidationSummary,
  validateAll,
} from './processBuilderValidation';

export function useProcessBuilderValidation(
  decisionProfileId: string | undefined,
): ValidationSummary {
  const instanceData = useProcessBuilderStore((state) =>
    decisionProfileId ? state.instances[decisionProfileId] : undefined,
  );

  return useMemo(() => validateAll(instanceData), [instanceData]);
}
