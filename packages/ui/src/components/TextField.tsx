'use client';

import { TextField as AriaTextField } from 'react-aria-components';

import { composeTailwindRenderProps } from '../utils';

import {
  Description,
  FieldError,
  FieldGroup,
  Input,
  InputVariantsProps,
  Label,
  TextArea,
} from './Field';

import type {
  TextFieldProps as AriaTextFieldProps,
  InputProps,
  TextAreaProps,
  ValidationResult,
} from 'react-aria-components';

export interface TextFieldProps extends AriaTextFieldProps {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  inputProps?: InputProps & { className?: string };
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
  color,
  size,
  ...props
}: TextFieldProps &
  InputVariantsProps & {
    ref?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
    children?: React.ReactNode;
  }) => {
  return (
    <AriaTextField
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'flex flex-col gap-2',
      )}
    >
      {label && <Label className={labelClassName}>{label}</Label>}
      <FieldGroup className={fieldClassName}>
        {useTextArea ? (
          <TextArea
            {...textareaProps}
            ref={ref as React.RefObject<HTMLTextAreaElement>}
          />
        ) : (
          <Input
            {...inputProps}
            color={color}
            size={size}
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
