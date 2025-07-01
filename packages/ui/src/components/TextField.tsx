'use client';

import { TextField as AriaTextField } from 'react-aria-components';
import type {
  TextFieldProps as AriaTextFieldProps,
  TextAreaProps,
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
  TextArea,
} from './Field';
import type { InputWithVariantsProps } from './Field';

export interface TextFieldProps extends AriaTextFieldProps {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  inputProps?: InputWithVariantsProps & { className?: string };
  textareaProps?: TextAreaProps & { className?: string };
  fieldClassName?: string;
  descriptionClassName?: string;
  labelClassName?: string;
  useTextArea?: boolean;
}

export const TextField = ({
  ref,
  label,
  description,
  errorMessage,
  inputProps,
  textareaProps,
  fieldClassName,
  descriptionClassName,
  labelClassName,
  useTextArea,
  children,
  isRequired, // we pull this out as it conflicts with other form validation libraries
  ...props
}: TextFieldProps & {
  ref?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  children?: React.ReactNode;
}) => {
  return (
    <AriaTextField
      {...props}
      isInvalid={!!errorMessage && errorMessage.length > 0}
      className={composeTailwindRenderProps(
        props.className,
        'group flex flex-col gap-1',
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
      <FieldGroup className={fieldClassName}>
        {useTextArea ? (
          <TextArea
            {...textareaProps}
            className={cn(
              textareaProps?.className,
              'group-data-[invalid=true]:outline-1 group-data-[invalid=true]:outline-functional-red',
            )}
            ref={ref as React.RefObject<HTMLTextAreaElement>}
          />
        ) : (
          <Input
            {...inputProps}
            className={cn(
              inputProps?.className,
              'group-data-[invalid=true]:outline-1 group-data-[invalid=true]:outline-functional-red',
            )}
            ref={ref as React.RefObject<HTMLInputElement>}
          />
        )}
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
