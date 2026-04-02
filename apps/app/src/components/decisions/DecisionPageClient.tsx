'use client';

import { type ProcessPhase } from '@op/api/encoders';
import { Skeleton } from '@op/ui/Skeleton';
import { cn } from '@op/ui/utils';
import { Suspense } from 'react';

import { DecisionInstanceHeader } from './DecisionInstanceHeader';
import { DecisionProcessStepper } from './DecisionProcessStepper';
import { DecisionStateRouter } from './DecisionStateRouter';
import { DecisionTranslationProvider } from './DecisionTranslationContext';

interface DecisionPageClientProps {
  currentStateId: string;
  decisionProfileId: string;
  decisionSlug: string;
  instanceId: string;
  isAdmin?: boolean;
  isResultsPhase: boolean;
  phases: ProcessPhase[];
  slug: string;
  title: string;
}

export function DecisionPageClient({
  currentStateId,
  decisionProfileId,
  decisionSlug,
  instanceId,
  isAdmin,
  isResultsPhase,
  phases,
  slug,
  title,
}: DecisionPageClientProps) {
  return (
    <div
      className={cn(
        isResultsPhase
          ? 'bg-redPurple text-neutral-offWhite'
          : 'bg-neutral-offWhite text-gray-700',
      )}
    >
      <DecisionInstanceHeader
        backTo={{ href: '/decisions' }}
        title={title}
        decisionSlug={decisionSlug}
        isAdmin={isAdmin}
      />
      <DecisionTranslationProvider>
        <div className="flex flex-col overflow-x-auto sm:items-center">
          <div className="w-fit rounded-b border border-t-0 bg-white px-12 py-4 sm:px-32">
            <DecisionProcessStepper
              phases={phases}
              currentStateId={currentStateId}
              className="mx-auto"
            />
          </div>
        </div>

        <Suspense fallback={<Skeleton className="h-96" />}>
          <DecisionStateRouter
            instanceId={instanceId}
            slug={slug}
            decisionSlug={decisionSlug}
            decisionProfileId={decisionProfileId}
          />
        </Suspense>
      </DecisionTranslationProvider>
    </div>
  );
}
