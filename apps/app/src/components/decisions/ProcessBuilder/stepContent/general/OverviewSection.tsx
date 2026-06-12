'use client';

import { Suspense } from 'react';

import type { SectionProps } from '../../contentRegistry';
import { OverviewSectionForm } from './OverviewSectionForm';
import { OverviewSectionSkeleton } from './OverviewSectionSkeleton';

export default function OverviewSection(props: SectionProps) {
  return (
    <Suspense fallback={<OverviewSectionSkeleton />}>
      <OverviewSectionForm {...props} />
    </Suspense>
  );
}
