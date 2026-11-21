import { useQueryState } from 'nuqs';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { ErrorMessage } from '@/components/ErrorMessage';
import type { SectionProps } from '@/components/decisions/ProcessBuilder/contentRegistry';
import { sectionIdToReviewPhaseId } from '@/components/decisions/ProcessBuilder/navigationConfig';

import { ReviewSettingsContent } from './ReviewSettingsContent';

export default function ReviewSettingsSection(props: SectionProps) {
  const [sectionParam] = useQueryState('section', { history: 'push' });
  const phaseKey = sectionParam ? sectionIdToReviewPhaseId(sectionParam) : null;

  return (
    <ErrorBoundary fallback={<ErrorMessage />}>
      <Suspense fallback={<ReviewSettingsSkeleton />}>
        <ReviewSettingsContent key={phaseKey ?? 'reviewSettings'} {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

function ReviewSettingsSkeleton() {
  return (
    <div className="mx-auto w-full animate-pulse space-y-8 p-4 md:max-w-160 md:p-8">
      <div className="h-7 w-24 rounded bg-secondary" />
      <div className="space-y-4">
        <div className="h-5 w-20 rounded bg-secondary" />
        <div className="h-4 w-64 rounded bg-secondary" />
        <div className="space-y-3">
          <div className="h-10 w-full rounded bg-secondary" />
          <div className="h-10 w-full rounded bg-secondary" />
          <div className="h-10 w-full rounded bg-secondary" />
        </div>
      </div>
      <div className="h-px w-full bg-secondary" />
      <div className="space-y-4">
        <div className="h-5 w-24 rounded bg-secondary" />
        <div className="h-12 w-full rounded bg-secondary" />
        <div className="h-12 w-full rounded bg-secondary" />
      </div>
    </div>
  );
}
