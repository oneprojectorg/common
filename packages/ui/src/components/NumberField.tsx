'use client';

import { useEffect, useRef, useState } from 'react';
import { TextField as AriaTextField } from 'react-aria-components';
import type {
  TextFieldProps as AriaTextFieldProps,
  ValidationResult,
} from 'react-aria-components';

import { cn } from '../lib/utils';
import { composeTailwindRenderProps } from '../utils';
import { Description, FieldError, FieldGroup, Input, Label } from './Field';
import type { InputWithVariantsProps } from './Field';

export interface NumberFieldProps
  extends Omit<
    AriaTextFieldProps,
    'type' | 'value' | 'defaultValue' | 'onChange' | 'onInput'
  > {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  inputProps?: InputWithVariantsProps & { className?: string };
  fieldClassName?: string;
  descriptionClassName?: string;
  labelClassName?: string;
  value?: number | null;
  defaultValue?: number | null;
  prefixText?: string;
  onChange?: (value: number | null) => void;
  onInput?: (value: number | null) => void;
}

const filterNumericInput = (value: string) => {
  return value
    .replace(/[^0-9.-]/g, '') // Keep only digits, minus, and decimal
    .replace(/(?!^)-/g, '') // Remove minus signs that aren't at the beginning
    .replace(/\.(?=.*\.)/g, ''); // Remove decimal points except the last one
};

const parseNumericValue = (value: string) => {
  const filtered = filterNumericInput(value);
  if (filtered === '' || filtered === '-') return null;
  const parsed = parseFloat(filtered);
  return isNaN(parsed) ? null : parsed;
};

export const NumberField = ({
  ref,
  label,
  description,
  errorMessage,
  inputProps,
  fieldClassName,
  descriptionClassName,
  labelClassName,
  value,
  defaultValue,
  prefixText,
  onChange,
  onInput,
  children,
  isRequired,
  ...props
}: NumberFieldProps & {
  ref?: React.RefObject<HTMLInputElement | null>;
  children?: React.ReactNode;
}) => {
  const [displayValue, setDisplayValue] = useState('');
  const [prefixWidth, setPrefixWidth] = useState(0);
  const prefixRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (value !== undefined) {
      setDisplayValue(value?.toString() || '');
    }
  }, [value]);

  useEffect(() => {
    if (value === undefined && defaultValue !== undefined) {
      setDisplayValue(defaultValue?.toString() || '');
    }
  }, [defaultValue, value]);

  useEffect(() => {
    if (prefixText && prefixRef.current) {
      const updatePrefixWidth = () => {
        if (prefixRef.current) {
          setPrefixWidth(prefixRef.current.offsetWidth);
        }
      };

      updatePrefixWidth();

      const resizeObserver = new ResizeObserver(updatePrefixWidth);
      resizeObserver.observe(prefixRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [prefixText]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const filteredValue = filterNumericInput(inputValue);
    const numericValue = parseNumericValue(filteredValue);

    setDisplayValue(filteredValue);
    onChange?.(numericValue);
  };

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    const inputValue = target.value;
    const filteredValue = filterNumericInput(inputValue);
    const numericValue = parseNumericValue(filteredValue);

    setDisplayValue(filteredValue);
    onInput?.(numericValue);
  };

  return (
    <AriaTextField
      {...props}
      type="text"
      isInvalid={!!errorMessage && errorMessage.length > 0}
      className={composeTailwindRenderProps(
        props.className,
        'group gap-1 flex flex-col',
      )}
    >
      {label && (
        <Label
          className={cn(
            labelClassName,
            'group-data-[invalid=true]:text-functional-red',
          )}
        >
          {label}
          {isRequired && <span className="text-functional-red"> *</span>}
        </Label>
      )}
      <FieldGroup className={cn(fieldClassName, prefixText && 'relative')}>
        {prefixText && (
          <span
            ref={prefixRef}
            className="bottom-0 left-0 top-0 pl-3 pr-2 pointer-events-none absolute flex items-center justify-center text-neutral-gray4 select-none"
          >
            {prefixText}
          </span>
        )}
        <Input
          {...inputProps}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onInput={handleInput}
          style={{
            paddingLeft: prefixText ? `${prefixWidth}px` : undefined,
          }}
          className={cn(
            inputProps?.className,
            'group-data-[invalid=true]:outline-1 group-data-[invalid=true]:outline-functional-red',
          )}
          ref={ref as React.RefObject<HTMLInputElement>}
        />
        {children}
      </FieldGroup>

      {description && (
        <Description className={descriptionClassName}>
          {description}
        </Description>
      )}
      <FieldError>{errorMessage}</FieldError>
    </AriaTextField>
  );
};
