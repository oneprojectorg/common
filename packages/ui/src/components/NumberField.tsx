'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { NumberField as AriaNumberField, Button } from 'react-aria-components';
import type {
  NumberFieldProps as AriaNumberFieldProps,
  ButtonProps as RACButtonProps,
  ValidationResult,
} from 'react-aria-components';

import { cn } from '../lib/utils';
import { composeTailwindRenderProps } from '../utils';
import {
  Description,
  FieldError,
  FieldGroup,
  Input,
  Label,
  fieldBorderStyles,
} from './Field';

const StepperButton = (props: RACButtonProps) => {
  return (
    <Button
      {...props}
      className="cursor-default px-0.5 text-neutral-600 pressed:bg-neutral-200 group-disabled:text-neutral-400"
    />
  );
};

export interface NumberFieldProps extends AriaNumberFieldProps {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  onDoubleClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
  inputClassName?: string;
  fieldClassName?: string;
  showStepper?: boolean;
  placeholder?: string;
}

export const NumberField = ({
  label,
  description,
  errorMessage,
  showStepper = true,
  fieldClassName,
  placeholder,
  ...props
}: NumberFieldProps) => {
  return (
    <AriaNumberField
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'group flex flex-col gap-1',
      )}
      formatOptions={{
        useGrouping: false,
      }}
    >
      <Label hidden>{label}</Label>
      <FieldGroup className={fieldClassName}>
        {(renderProps) => (
          <>
            <Input
              className={cn('', props.inputClassName)}
              onDoubleClick={props.onDoubleClick}
              placeholder={placeholder}
            />
            {showStepper && (
              <div
                className={fieldBorderStyles({
                  ...renderProps,
                  class: 'flex flex-col border-s-2',
                })}
              >
                <StepperButton slot="increment">
                  <ChevronUp aria-hidden className="size-4" />
                </StepperButton>
                <div
                  className={fieldBorderStyles({
                    ...renderProps,
                    class: 'border-b-2',
                  })}
                />
                <StepperButton slot="decrement">
                  <ChevronDown aria-hidden className="size-4" />
                </StepperButton>
              </div>
            )}
          </>
        )}
      </FieldGroup>
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
    </AriaNumberField>
  );
};
