'use client';

import { trpc } from '@op/api/client';
import type { ReviewsPolicy } from '@op/common';
import { Chip } from '@op/ui-next/Chip';
import { Field, FieldLabel } from '@op/ui-next/Field';
import { Header2, Header3 } from '@op/ui-next/Header';
import { RadioGroup, RadioGroupItem } from '@op/ui-next/RadioGroup';
import { ToggleButton } from '@op/ui/ToggleButton';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useProcessBuilderAutosave } from '../../ProcessBuilderAutosaveContext';
import { SaveStatusIndicator } from '../../components/SaveStatusIndicator';
import { ToggleRow } from '../../components/ToggleRow';
import type { SectionProps } from '../../contentRegistry';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';

interface ReviewSettings {
  reviewsPolicy: ReviewsPolicy;
  reviewsAllowRevisions: boolean;
}

export function ReviewSettingsContent({
  instanceId,
  decisionProfileId,
}: SectionProps) {
  const t = useTranslations();

  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });
  const config = instance.instanceData?.config;

  const instanceData = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId],
  );
  const { saveChanges, autosaveStatus } = useProcessBuilderAutosave();

  const [settings, setSettings] = useState<ReviewSettings>({
    reviewsPolicy:
      instanceData?.config?.reviewsPolicy ??
      config?.reviewsPolicy ??
      'full_coverage',
    reviewsAllowRevisions:
      instanceData?.config?.reviewsAllowRevisions ??
      config?.reviewsAllowRevisions ??
      true,
  });

  const updateSettings = (updates: Partial<ReviewSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...updates };
      saveChanges({ config: updated });
      return updated;
    });
  };

  return (
    <div className="mx-auto w-full space-y-8 p-4 [scrollbar-gutter:stable] md:max-w-160 md:p-8">
      <div className="flex items-center justify-between">
        <Header2 className="font-serif text-title-base">{t('Reviews')}</Header2>
        <SaveStatusIndicator
          status={autosaveStatus.status}
          savedAt={autosaveStatus.savedAt}
        />
      </div>

      {/* Coverage */}
      <section className="space-y-4">
        <Header3 className="font-serif text-title-sm">{t('Coverage')}</Header3>
        <Field>
          <FieldLabel className="text-sm font-normal text-neutral-gray4">
            {t('How should proposals get distributed to reviewers?')}
          </FieldLabel>
          <RadioGroup
            value={settings.reviewsPolicy}
            onValueChange={(value) =>
              updateSettings({ reviewsPolicy: value as ReviewsPolicy })
            }
            aria-label={t('Coverage')}
            className="flex flex-col gap-2"
          >
            <label
              htmlFor="reviews-full"
              className="flex items-start gap-2 py-2"
            >
              <RadioGroupItem
                id="reviews-full"
                value="full_coverage"
                className="mt-1"
              />
              <div className="flex flex-col">
                <span className="text-base text-neutral-charcoal">
                  {t('Full coverage')}
                </span>
                <span className="text-sm text-neutral-gray4">
                  {t('Every reviewer scores every proposal')}
                </span>
              </div>
            </label>
            <label
              htmlFor="reviews-self"
              className="flex items-start gap-2 py-2 opacity-50"
            >
              <RadioGroupItem
                id="reviews-self"
                value="self_selection"
                disabled
                className="mt-1"
              />
              <div className="flex flex-col">
                <span className="flex items-center gap-2 text-base text-neutral-charcoal">
                  {t('Self-selection')}
                  <Chip className="opacity-100">{t('Coming soon')}</Chip>
                </span>
                <span className="text-sm text-neutral-gray4">
                  {t('Reviewers choose what proposals to review')}
                </span>
              </div>
            </label>
            <label
              htmlFor="reviews-random"
              className="flex items-start gap-2 py-2 opacity-50"
            >
              <RadioGroupItem
                id="reviews-random"
                value="random_assignment"
                disabled
                className="mt-1"
              />
              <div className="flex flex-col">
                <span className="flex items-center gap-2 text-base text-neutral-charcoal">
                  {t('Random assignment')}
                  <Chip className="opacity-100">{t('Coming soon')}</Chip>
                </span>
                <span className="text-sm text-neutral-gray4">
                  {t('Proposals are randomly distributed among reviewers')}
                </span>
              </div>
            </label>
          </RadioGroup>
        </Field>
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
            <ToggleButton
              isSelected={settings.reviewsAllowRevisions}
              onChange={(val) => updateSettings({ reviewsAllowRevisions: val })}
              size="small"
            />
          </ToggleRow>
        </div>
      </section>
    </div>
  );
}
