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
      <FieldGroup className="relative">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-darkGray"
        />
        <Input className="px-10 [&::-webkit-search-cancel-button]:hidden" />
        <Button
          variant="icon"
          color="ghost"
          className="absolute right-1 top-1/2 aspect-square w-6 -translate-y-1/2 p-0 group-empty:invisible"
        >
          <XIcon aria-hidden className="size-4" />
        </Button>
      </FieldGroup>
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
    </AriaSearchField>
  );
};
