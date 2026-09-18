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
        description={t("We'll show you how it maps onto Common.")}
      />
      <ChoiceList
        idPrefix="process-type"
        options={TYPE_OPTIONS}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
