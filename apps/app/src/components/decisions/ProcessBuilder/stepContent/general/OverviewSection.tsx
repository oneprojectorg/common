'use client';

import { Suspense, useEffect, useState } from 'react';

import type { SectionProps } from '../../contentRegistry';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';
import { OverviewSectionForm } from './OverviewSectionForm';
import { OverviewSectionSkeleton } from './OverviewSectionSkeleton';

// Wrapper component that waits for Zustand hydration before rendering the form
export default function OverviewSection(props: SectionProps) {
  const [hasHydrated, setHasHydrated] = useState(() =>
    useProcessBuilderStore.persist.hasHydrated(),
  );

  useEffect(() => {
    const unsubscribe = useProcessBuilderStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    void useProcessBuilderStore.persist.rehydrate();

    return unsubscribe;
  }, []);

  if (!hasHydrated) {
    return <OverviewSectionSkeleton />;
  }

  return (
    <Suspense fallback={<OverviewSectionSkeleton />}>
      <OverviewSectionForm {...props} />
    </Suspense>
  );
}
