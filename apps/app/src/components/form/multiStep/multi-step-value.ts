import type { OnNext, OnBack } from '@formity/react';

export interface MultiStepValue {
  onNext: OnNext;
  onBack: OnBack;
}
