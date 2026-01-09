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
  placeholder?: string;
}

export const SearchField = ({
  label,
  description,
  errorMessage,
  placeholder,
  ...props
}: SearchFieldProps) => {
  return (
    <AriaSearchField
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'group gap-1 flex min-w-[40px] flex-col',
      )}
    >
      {label && <Label>{label}</Label>}
      <FieldGroup className="relative">
        <SearchIcon
          aria-hidden
          className="left-3 size-4 pointer-events-none absolute top-1/2 -translate-y-1/2 text-darkGray"
        />
        <Input
          placeholder={placeholder}
          className="px-10 [&::-webkit-search-cancel-button]:hidden"
        />
        <Button
          variant="icon"
          color="ghost"
          className="right-1 w-6 p-0 absolute top-1/2 aspect-square -translate-y-1/2 group-empty:invisible"
        >
          <XIcon aria-hidden className="size-4" />
        </Button>
      </FieldGroup>
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
    </AriaSearchField>
  );
};
