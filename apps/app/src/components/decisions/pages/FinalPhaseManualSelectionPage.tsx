'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { EmptyState } from '@op/ui/EmptyState';
import { Header3 } from '@op/ui/Header';
import { Suspense } from 'react';
import { LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n/routing';

import { DecisionHero } from '../DecisionHero';
import { ManualSelectionList } from '../ManualSelectionList';

// Hoisted so Tailwind's content scanner sees the literal class name. Inline
// JSX attribute values (e.g. `gradient="bg-coralCoral"`) weren't being picked
// up, leaving the gradient utility uncompiled.
const HERO_GRADIENT = 'bg-coralCoral';

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
      <div className="mx-auto flex max-w-4xl flex-col justify-center gap-4 px-4">
        <DecisionHero
          title={t('CONFIRM THE WINNING PROPOSALS')}
          description={t(
            "We've selected the suggested winning proposals based on voting rules and total budget.",
          )}
          variant="standard"
          gradient={HERO_GRADIENT}
        />
      </div>

      <div className="mt-8 flex w-full justify-center border-t bg-white">
        <div className="w-full gap-8 p-4 sm:max-w-6xl sm:p-8">
          <div className="flex flex-col gap-6 lg:col-span-3">
            <APIErrorBoundary
              fallbacks={{
                default: () => (
                  <EmptyState icon={<LuTriangleAlert className="size-6" />}>
                    <Header3 className="font-serif font-light">
                      {t("Couldn't load manual selection")}
                    </Header3>
                    <p className="text-base text-neutral-charcoal">
                      {t('Refresh the page to try again.')}
                    </p>
                  </EmptyState>
                ),
              }}
            >
              <Suspense fallback={null}>
                <ManualSelectionList
                  instanceId={instanceId}
                  decisionSlug={decisionSlug}
                  confirmButtonLabel={t('Confirm winning proposals')}
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
