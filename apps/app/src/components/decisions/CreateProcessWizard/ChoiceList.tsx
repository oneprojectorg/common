'use client';

import { Checkbox } from '@op/sense/Checkbox';
import { OptionBox } from '@op/sense/OptionBox';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import { STEP_HEADING_ID } from './StepHeading';
import type { Choice } from './types';

/**
 * The wizard's two answer shapes, both built on `OptionBox` so a question reads
 * the same whether it takes one answer or several. Each list is labelled by the
 * step heading, which is the question being asked.
 *
 * Both carry `bg-background`: the wizard's canvas is `bg-muted`, so an
 * unselected box needs the surface token to read as a card rather than as a hole
 * in the page. The box variant's `has-data-checked:bg-accent` still tints it
 * once selected.
 */

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
  /** Rendered on the side opposite the control — the process-type icons. */
  renderAccessory?: (key: K) => ReactNode;
  /** Element naming this group. Defaults to the step heading, i.e. the question. */
  labelledBy?: string;
}) {
  const t = useTranslations();

  return (
    <RadioGroup
      aria-labelledby={labelledBy}
      value={value}
      // Base UI hands back the raw value; match it against the known keys
      // rather than asserting the type.
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
  /**
   * Rendered under an option while it is checked — the "Something else" text
   * field. Deliberately a sibling of the box, not a child: the box is a
   * `<label>`, and a text input inside it would toggle the checkbox on click.
   */
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
