'use client';

import { Suspense } from 'react';

import type { SectionProps } from '../../contentRegistry';
import { PhasesSectionContent } from './PhasesSectionContent';
import { PhasesSectionSkeleton } from './PhasesSectionSkeleton';

export default function PhasesSection(props: SectionProps) {
  return (
    <Suspense fallback={<PhasesSectionSkeleton />}>
      <PhasesSectionContent {...props} />
    </Suspense>
  );
}
