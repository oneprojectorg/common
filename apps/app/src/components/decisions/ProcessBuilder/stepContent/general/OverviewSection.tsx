'use client';

import { useEffect, useState } from 'react';

import type { SectionProps } from '../../contentRegistry';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';
import { OverviewSectionForm } from './OverviewSectionForm';
import { OverviewSectionSkeleton } from './OverviewSectionSkeleton';

// Wrapper component that waits for Zustand hydration before rendering the form
export default function OverviewSection(props: SectionProps) {
  const [hasHydrated, setHasHydrated] = useState(false);

  // Handle hydration detection - wait for Zustand to load from localStorage
  useEffect(() => {
    // Check if already hydrated
    if (useProcessBuilderStore.persist.hasHydrated?.()) {
      setHasHydrated(true);
      return;
    }

    // Set up hydration listener
    const unsubscribe = useProcessBuilderStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    // Fallback: assume hydrated after a short delay if callback doesn't fire
    const fallbackTimeout = setTimeout(() => {
      setHasHydrated(true);
    }, 100);

    return () => {
      unsubscribe();
      clearTimeout(fallbackTimeout);
    };
  }, []);

  // Show skeleton until Zustand has hydrated from localStorage
  if (!hasHydrated) {
    return <OverviewSectionSkeleton />;
  }

  // Only render the form after hydration so defaultValues are correct
  return <OverviewSectionForm {...props} />;
}
