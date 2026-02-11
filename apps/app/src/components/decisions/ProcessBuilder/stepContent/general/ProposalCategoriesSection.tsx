'use client';

import { Suspense, useEffect, useState } from 'react';

import type { SectionProps } from '../../contentRegistry';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';
import { ProposalCategoriesSectionContent } from './ProposalCategoriesSectionContent';
import { ProposalCategoriesSectionSkeleton } from './ProposalCategoriesSectionSkeleton';

// Wrapper component that waits for Zustand hydration before rendering content
export default function ProposalCategoriesSection(props: SectionProps) {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const unsubscribe = useProcessBuilderStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    void useProcessBuilderStore.persist.rehydrate();

    return unsubscribe;
  }, []);

  if (!hasHydrated) {
    return <ProposalCategoriesSectionSkeleton />;
  }

  return (
    <Suspense fallback={<ProposalCategoriesSectionSkeleton />}>
      <ProposalCategoriesSectionContent {...props} />
    </Suspense>
  );
}
