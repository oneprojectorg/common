import type { OnBack, OnNext } from '@formity/react';

export interface MultiStepValue {
  onNext: OnNext;
  onBack: OnBack;
}
