'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import type { InstancePhaseData } from '@op/api/encoders';
import type { ReviewsScope } from '@op/common';
import { isReviewPhase } from '@op/common/client';
import { Badge } from '@op/sense/Badge';
import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldDescription,
  FieldContent,
} from '@op/sense/Field';
import { Header1, Header3 } from '@op/sense/Header';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { Switch } from '@op/sense/Switch';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ToggleRow } from '@/components/layout/split/form/ToggleRow';

import { useProcessBuilderAutosave } from '../../ProcessBuilderAutosaveContext';
import { SaveStatusIndicator } from '../../components/SaveStatusIndicator';
import type { SectionProps } from '../../contentRegistry';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';
import { CategoryReviewerCards } from './CategoryReviewerCards';

interface ReviewSettings {
  scope: ReviewsScope;
  reviewsAllowRevisions: boolean;
}

export function ReviewSettingsContent({
  instanceId,
  decisionProfileId,
}: SectionProps) {
  const t = useTranslations();
  // Gates the by-category scope. When off, the radio stays disabled with a
  // "Coming soon" chip (pre-flag behavior) and the reviewer cards never render.
  const byCategoryEnabled = useFeatureFlag('reviews_by_category');

  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });
  const config = instance.instanceData?.config;
  const instancePhases = instance.instanceData?.phases;

  const storeInstance = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId],
  );
  const storePhases = storeInstance?.phases;
  const { saveChanges, autosaveStatus } = useProcessBuilderAutosave();

  // Store-first so unsaved phase edits (e.g. toggling review capability in the
  // phase editor) are reflected here, matching PhaseDetailPage's resolution.
  const sourcePhases: InstancePhaseData[] =
    (storePhases?.length ? storePhases : instancePhases) ?? [];

  // Scope is a per-phase review setting: there is exactly one review-capable
  // phase today (the Reviews step is only shown when one exists).
  const reviewPhase = sourcePhases.find(isReviewPhase);

  const [settings, setSettings] = useState<ReviewSettings>({
    scope: reviewPhase?.rules?.reviews?.scope ?? 'all',
    reviewsAllowRevisions:
      storeInstance?.config?.reviewsAllowRevisions ??
      config?.reviewsAllowRevisions ??
      true,
  });

  // The write replaces the full phases array, so every phase must be sent.
  // Only the review phase's rules change; sibling rules keys (and other
  // phases) are preserved untouched.
  const phasesWithScope = (nextScope: ReviewsScope): InstancePhaseData[] =>
    sourcePhases.map((phase) => ({
      phaseId: phase.phaseId,
      name: phase.name,
      description: phase.description,
      headline: phase.headline,
      additionalInfo: phase.additionalInfo,
      startDate: phase.startDate,
      endDate: phase.endDate,
      rules:
        phase.phaseId === reviewPhase?.phaseId
          ? {
              ...phase.rules,
              reviews: { ...phase.rules?.reviews, scope: nextScope },
            }
          : phase.rules,
    }));

  const updateSettings = (updates: Partial<ReviewSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...updates };
      // scope and revisions write to different places: scope to the review
      // phase's rules, revisions to legacy config. Route each independently.
      if (updates.scope !== undefined && reviewPhase) {
        saveChanges({ phases: phasesWithScope(updated.scope) });
      }
      if (updates.reviewsAllowRevisions !== undefined) {
        saveChanges({
          config: { reviewsAllowRevisions: updated.reviewsAllowRevisions },
        });
      }
      return updated;
    });
  };

  return (
    <div className="mx-auto w-full space-y-8 p-4 [scrollbar-gutter:stable] md:max-w-160 md:p-8">
      <div className="flex items-center justify-between">
        <Header1 className="text-headline">{t('Reviews')}</Header1>
        <SaveStatusIndicator
          status={autosaveStatus.status}
          savedAt={autosaveStatus.savedAt}
        />
      </div>

      {/* Scope */}
      <section className="space-y-4">
        <Header3 className="font-serif text-title-sm">{t('Scope')}</Header3>
        <FieldSet>
          <FieldLegend className="mb-3 text-base!">
            {t('What should each reviewer be responsible for?')}
          </FieldLegend>
          <RadioGroup
            value={settings.scope}
            onValueChange={(value) =>
              updateSettings({ scope: value as ReviewsScope })
            }
            aria-label={t('Scope')}
            className="gap-3"
          >
            <Field orientation="horizontal">
              <RadioGroupItem id="scope-all" value="all" />
              <FieldContent>
                <FieldLabel htmlFor="scope-all">
                  {t('All proposals')}
                </FieldLabel>
                <FieldDescription>
                  {t('Reviewers can review any submission')}
                </FieldDescription>
              </FieldContent>
            </Field>
            <Field
              orientation="horizontal"
              data-disabled={!byCategoryEnabled || undefined}
            >
              <RadioGroupItem
                id="scope-by_category"
                value="by_category"
                disabled={!byCategoryEnabled}
              />
              <FieldContent>
                <FieldLabel htmlFor="scope-by_category">
                  {t('By category')}
                  {!byCategoryEnabled && (
                    <Badge variant="secondary">{t('Coming soon')}</Badge>
                  )}
                </FieldLabel>
                <FieldDescription>
                  {t(
                    'Each reviewer is assigned to one or more categories. Their queue shows only proposals in those categories.',
                  )}
                </FieldDescription>
              </FieldContent>
            </Field>
          </RadioGroup>
        </FieldSet>

        {byCategoryEnabled && settings.scope === 'by_category' && (
          <>
            <hr className="border-neutral-gray1" />
            <CategoryReviewerCards instanceId={instanceId} />
          </>
        )}
      </section>

      <hr className="border-neutral-gray1" />

      {/* Revisions */}
      <section className="space-y-4">
        <Header3 className="font-serif text-title-sm">{t('Revisions')}</Header3>
        <div className="space-y-2">
          <ToggleRow
            label={t('Reviewers can request revisions')}
            description={t(
              'Reviewers can ask authors to revise their proposal before scoring',
            )}
          >
            <Switch
              checked={settings.reviewsAllowRevisions}
              onCheckedChange={(val) =>
                updateSettings({ reviewsAllowRevisions: val })
              }
            />
          </ToggleRow>
        </div>
      </section>
    </div>
  );
}
