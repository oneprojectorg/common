'use client';

import { Check } from 'lucide-react';
import {
  ListBox as AriaListBox,
  ListBoxItem as AriaListBoxItem,
  Collection,
  Header,
  ListBoxSection,
  composeRenderProps,
} from 'react-aria-components';
import type {
  ListBoxProps as AriaListBoxProps,
  ListBoxItemProps as RACListBoxItemProps,
  SectionProps,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';
import type { VariantProps } from 'tailwind-variants';

import { composeTailwindRenderProps, focusRing } from '../utils';
import { Label } from './Field';

interface ListBoxProps<T> extends AriaListBoxProps<T> {
  label?: string;
  isRequired?: boolean;
}

export const ListBox = <T extends object>({
  children,
  label,
  isRequired = false,
  ...props
}: ListBoxProps<T>) => {
  return (
    <>
      {label && (
        <Label>
          {label}
          {isRequired && <span className="text-red"> *</span>}
        </Label>
      )}
      <AriaListBox
        {...props}
        className={composeTailwindRenderProps(
          props.className,
          'rounded border p-1 outline-0',
        )}
      >
        {children}
      </AriaListBox>
    </>
  );
};

export const itemStyles = tv({
  extend: focusRing,
  base: 'group relative flex cursor-default select-none items-center gap-8 rounded px-2.5 py-1.5 text-sm will-change-transform forced-color-adjust-none',
  variants: {
    isSelected: {
      false: 'text-neutral-700 -outline-offset-2 hover:bg-neutral-300',
      true: 'bg-neutral-gray1 text-neutral-black -outline-offset-4 [&+[data-selected]]:rounded-t-none [&:has(+[data-selected])]:rounded-b-none',
    },
    isDisabled: {
      true: 'text-neutral-400',
    },
  },
});

type ListBoxItemVariants = VariantProps<typeof itemStyles>;

export interface ListBoxItemProps
  extends React.ComponentProps<typeof AriaListBoxItem>,
    ListBoxItemVariants {
  className?: string;
}

export const ListBoxItem = (props: ListBoxItemProps) => {
  const textValue =
    props.textValue ||
    (typeof props.children === 'string' ? props.children : undefined);

  return (
    <AriaListBoxItem
      {...props}
      textValue={textValue}
      className={itemStyles(props)}
    >
      {composeRenderProps(props.children, (children) => (
        <>
          {children}
          <div className="absolute inset-x-4 bottom-0 hidden h-px bg-white/20 [.group[data-selected]:has(+[data-selected])_&]:block" />
        </>
      ))}
    </AriaListBoxItem>
  );
};

export const dropdownItemStyles = tv({
  base: 'group flex cursor-default select-none items-center gap-4 rounded py-2 pl-3 pr-1.5 outline outline-0 forced-color-adjust-none',
  variants: {
    isDisabled: {
      false: 'text-neutral-black',
      true: 'text-neutral-400',
    },
    isFocused: {
      true: 'bg-neutral-gray1',
    },
  },
  compoundVariants: [
    {
      isFocused: false,
      isOpen: true,
      className: 'bg-neutral-gray1',
    },
  ],
});

export const DropdownItem = (
  props: RACListBoxItemProps & { className?: string },
) => {
  const textValue =
    props.textValue ||
    (typeof props.children === 'string' ? props.children : undefined);

  return (
    <AriaListBoxItem
      {...props}
      textValue={textValue}
      className={composeRenderProps(props.className, (className, renderProps) =>
        dropdownItemStyles({
          ...renderProps,
          className: `px-3 py-2 ${className || ''}`,
        }),
      )}
    >
      {composeRenderProps(props.children, (children, { isSelected }) => (
        <>
          <span className="group-hover:bgt-neutral-gray1 flex flex-1 items-center gap-2 truncate font-normal text-neutral-black">
            {children}
          </span>
          <span className="flex w-5 items-center">
            {isSelected && <Check className="size-4" />}
          </span>
        </>
      ))}
    </AriaListBoxItem>
  );
};

export interface DropdownSectionProps<T> extends SectionProps<T> {
  title?: string;
  items?: any;
}

export const DropdownSection = <T extends object>(
  props: DropdownSectionProps<T>,
) => {
  return (
    <ListBoxSection className="after:block after:h-[5px] after:content-[''] first:mt-[-5px]">
      <Header className="sticky top-[-5px] z-10 -mx-1 -mt-px truncate border-y border-neutral-300 bg-neutral-300/60 px-4 py-1 text-sm font-semibold text-neutral-700 backdrop-blur-md [&+*]:mt-1">
        {props.title}
      </Header>
      <Collection items={props.items}>{props.children}</Collection>
    </ListBoxSection>
  );
};
