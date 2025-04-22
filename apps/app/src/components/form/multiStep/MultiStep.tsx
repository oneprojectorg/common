import { useMemo } from 'react';

import { MultiStepContext } from './multi-step-context';

import type { OnBack, OnNext } from '@formity/react';
import type { ReactNode } from 'react';

interface MultiStepProps {
  onNext: OnNext;
  onBack: OnBack;
  children: ReactNode;
}

export function MultiStepProvider({
  onNext,
  onBack,
  children,
}: MultiStepProps) {
  const values = useMemo(() => ({ onNext, onBack }), [onNext, onBack]);

  return <MultiStepContext value={values}>{children}</MultiStepContext>;
}
