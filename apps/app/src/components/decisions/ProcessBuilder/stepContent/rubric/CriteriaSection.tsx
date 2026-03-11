'use client';

import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { ErrorMessage } from '@/components/ErrorMessage';
import type { SectionProps } from '@/components/decisions/ProcessBuilder/contentRegistry';

import { RubricEditorContent } from './RubricEditorContent';
import { RubricEditorSkeleton } from './RubricEditorSkeleton';

export default function CriteriaSection(props: SectionProps) {
  return (
    <ErrorBoundary fallback={<ErrorMessage />}>
      <Suspense fallback={<RubricEditorSkeleton />}>
        <RubricEditorContent {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}
