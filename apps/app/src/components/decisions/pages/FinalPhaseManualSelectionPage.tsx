'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Suspense } from 'react';
import { LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n/routing';

import { DecisionHero } from '../DecisionHero';
import { ManualSelectionList } from '../ManualSelectionList';

interface FinalPhaseManualSelectionPageProps {
  instanceId: string;
  decisionSlug: string;
}

export function FinalPhaseManualSelectionPage({
  instanceId,
  decisionSlug,
}: FinalPhaseManualSelectionPageProps) {
  const t = useTranslations();

  return (
    <div className="min-h-full pt-8">
      {/* Shared plain selection hero — same treatment as ReviewSelectionPage
          (Figma DECIDE ▸ Selection): no gradient band, no face pile, no
          in-hero action. */}
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-4 px-4 pb-8">
        <DecisionHero
          title={t('Confirm the winning proposals')}
          description={t(
            "We've selected the suggested winning proposals based on voting rules and total budget.",
          )}
          variant="standard"
        />
      </div>

      <div className="flex w-full justify-center border-t bg-white">
        <div className="w-full p-4 sm:max-w-6xl sm:p-8">
          <div className="flex flex-col gap-6">
            <APIErrorBoundary
              fallbacks={{
                default: () => (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <LuTriangleAlert className="size-6" />
                      </EmptyMedia>
                      <EmptyTitle>
                        {t("Couldn't load manual selection")}
                      </EmptyTitle>
                      <EmptyDescription>
                        {t('Refresh the page to try again.')}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ),
              }}
            >
              <Suspense fallback={null}>
                <ManualSelectionList
                  instanceId={instanceId}
                  decisionSlug={decisionSlug}
                  confirmVariant="finalPhase"
                />
              </Suspense>
            </APIErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}
