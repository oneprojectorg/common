'use client';

import { Suspense, useEffect, useState } from 'react';

import type { SectionProps } from '../../contentRegistry';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';
import { PhasesSectionContent } from './PhasesSectionContent';
import { PhasesSectionSkeleton } from './PhasesSectionSkeleton';

export default function PhasesSection(props: SectionProps) {
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
    return <PhasesSectionSkeleton />;
  }

  return (
    <Suspense fallback={<PhasesSectionSkeleton />}>
      <PhasesSectionContent {...props} />
    </Suspense>
  );
}
