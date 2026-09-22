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
  const t = useTranslations('decisions.createWizard');

  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title={t('typeHeading')}
        description={t('typeDescription')}
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
