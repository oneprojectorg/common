'use client';

import { ReactNode, useContext } from 'react';
import {
  ComboBox as AriaComboBox,
  ComboBoxStateContext,
  ListBox,
} from 'react-aria-components';
import type {
  ComboBoxProps as AriaComboBoxProps,
  ListBoxItemProps,
  ListBoxRenderProps,
  ValidationResult,
} from 'react-aria-components';
import { LuChevronDown } from 'react-icons/lu';
import type { ComboBoxState } from 'react-stately';

import { cn } from '../lib/utils';
import { composeTailwindRenderProps } from '../utils';
import { Button } from './Button';
import type { ButtonProps } from './Button';
import { Description, FieldError, FieldGroup, Input, Label } from './Field';
import { DropdownItem, DropdownSection } from './ListBox';
import type { DropdownSectionProps } from './ListBox';
import { Popover } from './Popover';
import type { PopoverProps } from './Popover';

export interface ComboBoxProps<T extends object> extends Omit<
  AriaComboBoxProps<T>,
  'children'
> {
  label?: string;
  description?: string | null;
  errorMessage?: string | ((validation: ValidationResult) => string);
  children: React.ReactNode | ((item: T) => React.ReactNode);
  labelClassName?: string;
  inputClassName?: string;
  listBoxClassName?: string;
  fieldGroupClassName?: string;
  buttonProps?: Omit<ButtonProps, 'children'>;
  popoverProps?: Omit<PopoverProps, 'children'>;
  icon?: ReactNode;
  placeholder?: string;
  /**
   * Rendered inside the listbox when the collection is empty (paired with
   * `allowsEmptyCollection` so the popover stays open). Use this to surface a
   * "Searching…" / "No results" state to the user.
   */
  renderEmptyState?: (props: ListBoxRenderProps) => ReactNode;
}

export const ComboBox = <T extends object>({
  label,
  description,
  errorMessage,
  children,
  items,
  icon,
  placeholder,
  renderEmptyState,
  ...props
}: ComboBoxProps<T>) => {
  return (
    <AriaComboBox
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'group flex flex-col gap-1',
      )}
    >
      <Label className={props.labelClassName}>{label}</Label>
      <FieldGroup className={cn('relative', props.fieldGroupClassName)}>
        <ComboBoxInput
          className={props.inputClassName}
          placeholder={placeholder}
        />
        <Button
          variant="icon"
          color="ghost"
          {...props.buttonProps}
          className={cn(
            'absolute end-1 top-1/2 aspect-square w-6 -translate-y-1/2 p-0',
            props.buttonProps?.className,
          )}
        >
          {icon ?? <LuChevronDown aria-hidden className="size-4" />}
        </Button>
      </FieldGroup>
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
      <Popover
        {...props.popoverProps}
        className={cn(
          'absolute z-10 !max-h-60 min-w-(--trigger-width) overflow-hidden rounded border bg-white p-2 shadow',
          props.popoverProps?.className,
        )}
      >
        <ListBox
          items={items}
          renderEmptyState={renderEmptyState}
          className={cn(
            'max-h-60 overflow-auto py-1 outline-hidden',
            props.listBoxClassName,
          )}
        >
          {children}
        </ListBox>
      </Popover>
    </AriaComboBox>
  );
};

// Mobile soft keyboards (notably iOS) never fire the arrow-key navigation
// React Aria uses to mark a "focused" list item, so the default Enter handler
// sees `focusedKey == null` and closes the popover without committing anything.
// Walk the collection to find the first selectable suggestion (skipping section
// headers and disabled rows) so Enter behaves like a search submit when the
// user hasn't actively highlighted a row.
const isSelectableItem = (state: ComboBoxState<object>, key: string | number) =>
  state.collection.getItem(key)?.type === 'item' &&
  !state.disabledKeys.has(key);

const findFirstSelectableKey = (state: ComboBoxState<object>) => {
  for (
    let key = state.collection.getFirstKey();
    key != null;
    key = state.collection.getKeyAfter(key)
  ) {
    if (isSelectableItem(state, key)) {
      return key;
    }
  }
  return null;
};

const isEnterWithoutFocus = (
  e: React.KeyboardEvent<HTMLInputElement>,
  state: ComboBoxState<object>,
) =>
  e.key === 'Enter' &&
  !e.nativeEvent.isComposing &&
  state.isOpen &&
  state.selectionManager.focusedKey == null;

const ComboBoxInput = ({
  className,
  placeholder,
}: {
  className?: string;
  placeholder?: string;
}) => {
  const state = useContext(ComboBoxStateContext);
  const handleKeyDownCapture = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!state || !isEnterWithoutFocus(e, state)) {
      return;
    }
    const firstKey = findFirstSelectableKey(state);
    if (firstKey != null) {
      state.setSelectedKey(firstKey);
    }
  };
  return (
    <Input
      className={className}
      placeholder={placeholder}
      onClick={() => state?.open()}
      onKeyDownCapture={handleKeyDownCapture}
    />
  );
};

export const ComboBoxItem = (
  props: ListBoxItemProps & { className?: string },
) => {
  return <DropdownItem {...props} />;
};

export const ComboBoxSection = <T extends object>(
  props: DropdownSectionProps<T>,
) => {
  return <DropdownSection {...props} />;
};
