'use client';

import { Field, FieldDescription, FieldLabel } from '@op/sense/Field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupTextarea,
} from '@op/sense/InputGroup';
import type { ChangeEvent, ComponentProps, ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import type { DraftProblem } from './formDefinition';
import { ProblemMessages } from './formProblems';

interface CountedFieldProps {
  id: string;
  label: ReactNode;
  value: string;
  max: number;
  /** This box's problems only — the caller has already selected them. */
  problems: DraftProblem[];
  description?: ReactNode;
  onChange: (value: string) => void;
}

/**
 * A single-line text box under `label`, capped at `max` characters, showing
 * the count beside the input and `problems` beneath it. `max` is both the
 * `maxLength` and the number the counter names, so the two cannot disagree.
 */
export const CountedInputField = (props: CountedFieldProps) => (
  <CountedField {...props} align="inline-end">
    <InputGroupInput {...getControlProps(props)} />
  </CountedField>
);

/** {@link CountedInputField} for prose, with the count beneath the box. */
export const CountedTextareaField = (props: CountedFieldProps) => (
  <CountedField {...props} align="block-end" addonClassName="justify-end">
    <InputGroupTextarea {...getControlProps(props)} className="min-h-16" />
  </CountedField>
);

const CountedField = ({
  id,
  label,
  value,
  max,
  problems,
  description,
  align,
  addonClassName,
  children,
}: CountedFieldProps & {
  align: ComponentProps<typeof InputGroupAddon>['align'];
  addonClassName?: string;
  /** The control itself, already wired by the wrapper. */
  children: ReactNode;
}) => {
  const t = useTranslations();

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        {children}
        <InputGroupAddon align={align} className={addonClassName}>
          {t('decisions.processBuilder.characterCount', {
            count: value.length,
            max,
          })}
        </InputGroupAddon>
      </InputGroup>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <ProblemMessages problems={problems} />
    </Field>
  );
};

const getControlProps = ({
  id,
  value,
  max,
  problems,
  onChange,
}: CountedFieldProps) => ({
  id,
  value,
  maxLength: max,
  'aria-invalid': problems.length > 0,
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange(event.target.value),
});
