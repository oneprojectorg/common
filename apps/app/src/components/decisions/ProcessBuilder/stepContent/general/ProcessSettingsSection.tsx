'use client';

import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { ErrorMessage } from '@/components/ErrorMessage';
import type { SectionProps } from '@/components/decisions/ProcessBuilder/contentRegistry';

import { ProcessSettingsForm } from './ProcessSettingsForm';
import { ProcessSettingsSkeleton } from './ProcessSettingsSkeleton';

export default function ProcessSettingsSection(props: SectionProps) {
  return (
    <ErrorBoundary fallback={<ErrorMessage />}>
      <Suspense fallback={<ProcessSettingsSkeleton />}>
        <ProcessSettingsForm {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}
