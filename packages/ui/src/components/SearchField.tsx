'use client';

import { SearchIcon, XIcon } from 'lucide-react';
import { SearchField as AriaSearchField } from 'react-aria-components';
import type {
  SearchFieldProps as AriaSearchFieldProps,
  ValidationResult,
} from 'react-aria-components';

import { composeTailwindRenderProps } from '../utils';
import { Button } from './Button';
import { Description, FieldError, FieldGroup, Input, Label } from './Field';

export interface SearchFieldProps extends AriaSearchFieldProps {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
}

export const SearchField = ({
  label,
  description,
  errorMessage,
  ...props
}: SearchFieldProps) => {
  return (
    <AriaSearchField
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'group flex min-w-[40px] flex-col gap-1',
      )}
    >
      {label && <Label>{label}</Label>}
      <FieldGroup>
        <SearchIcon
          aria-hidden
          className="ml-2 size-4 text-neutral-600 group-disabled:text-neutral-400"
        />
        <Input className="[&::-webkit-search-cancel-button]:hidden" />
        <Button
          variant="icon"
          padding="none"
          className="mr-1 aspect-square w-6 group-empty:invisible"
        >
          <XIcon aria-hidden className="size-4" />
        </Button>
      </FieldGroup>
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
    </AriaSearchField>
  );
};
