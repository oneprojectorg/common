import { useContext } from 'react';

import { MultiStepContext } from './multi-step-context';

import type { MultiStepValue } from './multi-step-value';

export function useMultiStep(): MultiStepValue {
  const context = useContext(MultiStepContext);

  if (!context)
    throw new Error('useMultiStep must be used within a MultiStep');

  return context;
}
