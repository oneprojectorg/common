'use client';

import { Suspense, useEffect, useState } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { ErrorMessage } from '@/components/ErrorMessage';
import type { SectionProps } from '@/components/decisions/ProcessBuilder/contentRegistry';
import { useProcessBuilderStore } from '@/components/decisions/ProcessBuilder/stores/useProcessBuilderStore';

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
    <ErrorBoundary fallback={<ErrorMessage />}>
      <Suspense fallback={<ProcessSettingsSkeleton />}>
        <ProcessSettingsForm {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}
