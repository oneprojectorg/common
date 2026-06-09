'use client';

import { Suspense, useEffect, useState } from 'react';

import type { SectionProps } from '../../contentRegistry';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';
import { ProcessSettingsForm } from './ProcessSettingsForm';
import { ProcessSettingsSkeleton } from './ProcessSettingsSkeleton';

// Wrapper component that waits for Zustand hydration before rendering the form
export default function ProcessSettingsSection(props: SectionProps) {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const unsubscribe = useProcessBuilderStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    void useProcessBuilderStore.persist.rehydrate();

    return unsubscribe;
  }, []);

  if (!hasHydrated) {
    return <ProcessSettingsSkeleton />;
  }

  return (
    <Suspense fallback={<ProcessSettingsSkeleton />}>
      <ProcessSettingsForm {...props} />
    </Suspense>
  );
}
