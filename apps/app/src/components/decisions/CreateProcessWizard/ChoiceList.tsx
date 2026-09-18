'use client';

import { Checkbox } from '@op/sense/Checkbox';
import { OptionBox } from '@op/sense/OptionBox';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import { STEP_HEADING_ID } from './StepHeading';
import type { Choice } from './types';

/** `bg-background` because the wizard canvas is `bg-muted`. */
export function ChoiceList<K extends string>({
  options,
  value,
  onChange,
  idPrefix,
  renderAccessory,
  labelledBy = STEP_HEADING_ID,
}: {
  options: Choice<K>[];
  value: K | null;
  onChange: (key: K) => void;
  idPrefix: string;
  renderAccessory?: (key: K) => ReactNode;
  /** Defaults to the step heading, i.e. the question being asked. */
  labelledBy?: string;
}) {
  const t = useTranslations();

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
          <OptionBox
            key={option.key}
            htmlFor={id}
            control={<RadioGroupItem id={id} value={option.key} />}
            label={t(option.label)}
            description={option.description ? t(option.description) : undefined}
            accessory={renderAccessory?.(option.key)}
            className="bg-background"
          />
        );
      })}
    </RadioGroup>
  );
}

export function CheckList<K extends string>({
  options,
  values,
  onToggle,
  idPrefix,
  renderDetail,
}: {
  options: Choice<K>[];
  values: K[];
  onToggle: (key: K) => void;
  idPrefix: string;
  /** A sibling of the box, not a child: the box is a `<label>`. */
  renderDetail?: (key: K) => ReactNode;
}) {
  const t = useTranslations();

  return (
    <div
      role="group"
      aria-labelledby={STEP_HEADING_ID}
      className="flex flex-col gap-2.5"
    >
      {options.map((option) => {
        const id = `${idPrefix}-${option.key}`;
        const checked = values.includes(option.key);
        const detail = checked ? renderDetail?.(option.key) : null;

        return (
          <div key={option.key} className="flex flex-col gap-2">
            <OptionBox
              htmlFor={id}
              control={
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={() => onToggle(option.key)}
                />
              }
              label={t(option.label)}
              description={
                option.description ? t(option.description) : undefined
              }
              className="bg-background"
            />
            {detail}
          </div>
        );
      })}
    </div>
  );
}
