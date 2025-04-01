'use client';

import {
  ColorField as AriaColorField,
} from 'react-aria-components';

import { composeTailwindRenderProps } from '../utils';

import {
  Description,
  FieldError,
  fieldGroupStyles,
  Input,
  Label,
} from './Field';

import type {
  ColorFieldProps as AriaColorFieldProps,
  ValidationResult,
} from 'react-aria-components';

export interface ColorFieldProps extends AriaColorFieldProps {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
}

export const ColorField = ({
  label,
  description,
  errorMessage,
  ...props
}: ColorFieldProps) => {
  return (
    <AriaColorField
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'flex flex-col gap-1',
      )}
    >
      {label && <Label>{label}</Label>}
      <Input
        className={renderProps =>
          fieldGroupStyles({
            ...renderProps,
            isFocusWithin: renderProps.isFocused,
          })}
      />
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
    </AriaColorField>
  );
};
