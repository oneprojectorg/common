'use client';

import { useEffect, useState } from 'react';

import type { SectionProps } from '../../contentRegistry';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';
import { OverviewSectionForm } from './OverviewSectionForm';
import { OverviewSectionSkeleton } from './OverviewSectionSkeleton';

// Wrapper component that waits for Zustand hydration before rendering the form
export default function OverviewSection(props: SectionProps) {
  const [hasHydrated, setHasHydrated] = useState(false);

  // Manually trigger hydration and wait for completion
  // Using skipHydration: true in the store gives us full control over timing
  useEffect(() => {
    const unsubscribe = useProcessBuilderStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    // Manually trigger rehydration from localStorage
    void useProcessBuilderStore.persist.rehydrate();

    return unsubscribe;
  }, []);

  // Show skeleton until Zustand has hydrated from localStorage
  if (!hasHydrated) {
    return <OverviewSectionSkeleton />;
  }

  // Only render the form after hydration so defaultValues are correct
  return <OverviewSectionForm {...props} />;
}
