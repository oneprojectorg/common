'use client';

import { OptionBox } from '@op/sense/OptionBox';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import { STEP_HEADING_ID } from './StepHeading';
import type { Choice } from './types';

export function ChoiceList<K extends string>({
  options,
  value,
  onChange,
  idPrefix,
  labelledBy = STEP_HEADING_ID,
  renderDetail,
}: {
  options: Choice<K>[];
  value: K | null;
  onChange: (key: K) => void;
  idPrefix: string;
  labelledBy?: string;
  /** Under the chosen option, as a sibling of the box: the box is a `<label>`. */
  renderDetail?: (key: K) => ReactNode;
}) {
  const t = useTranslations('decisions.createWizard');

  return (
    <RadioGroup
      aria-labelledby={labelledBy}
      value={value}
      onValueChange={(next) => {
        const match = options.find((option) => option.key === next);

        if (match) {
          onChange(match.key);
        }
      }}
      className="gap-2.5"
    >
      {options.map((option) => {
        const id = `${idPrefix}-${option.key}`;

        return (
          <div key={option.key} className="flex flex-col gap-2">
            <OptionBox
              htmlFor={id}
              control={<RadioGroupItem id={id} value={option.key} />}
              label={t(option.label)}
              description={
                option.description ? t(option.description) : undefined
              }
              className="bg-background"
            />
            {value === option.key ? renderDetail?.(option.key) : null}
          </div>
        );
      })}
    </RadioGroup>
  );
}
