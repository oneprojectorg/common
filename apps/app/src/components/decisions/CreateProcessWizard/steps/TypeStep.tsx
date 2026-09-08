'use client';

import { useTranslations } from '@/lib/i18n';

import { ChoiceList } from '../ChoiceList';
import { StepHeading } from '../StepHeading';
import { TYPE_META, TYPE_ORDER } from '../content';
import type { Choice, ProcessType } from '../types';

const TYPE_OPTIONS: Choice<ProcessType>[] = TYPE_ORDER.map((type) => ({
  key: type,
  label: TYPE_META[type].label,
  description: TYPE_META[type].description,
}));

/** Step 2 — which kind of process, which decides what the mapping can be. */
export function TypeStep({
  value,
  onChange,
}: {
  value: ProcessType | null;
  onChange: (type: ProcessType) => void;
}) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title={t('What kind of process are you running?')}
        description={t(
          "We'll show you how it maps onto Common. You can change anything after.",
        )}
      />
      <ChoiceList
        idPrefix="process-type"
        options={TYPE_OPTIONS}
        value={value}
        onChange={onChange}
        renderAccessory={(type) => {
          const Icon = TYPE_META[type].icon;

          return (
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
              <Icon className="size-4.5" aria-hidden />
            </span>
          );
        }}
      />
    </div>
  );
}
