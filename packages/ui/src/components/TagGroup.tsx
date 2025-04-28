'use client';

import { XIcon } from 'lucide-react';
import { createContext, useContext } from 'react';
import {
  Tag as AriaTag,
  TagGroup as AriaTagGroup,
  Button,
  TagList,
  Text,
  composeRenderProps,
} from 'react-aria-components';
import type {
  TagGroupProps as AriaTagGroupProps,
  TagProps as AriaTagProps,
  TagListProps,
} from 'react-aria-components';
import { twMerge } from 'tailwind-merge';
import { tv } from 'tailwind-variants';

import { focusRing } from '../utils';
import { Description, Label } from './Field';

const colors = {
  transparent: 'bg-transparent border-neutral-400 text-neutral-600',
  gray: '  bg-neutral-300  text-neutral-700  border-neutral-400  hover:border-neutral-500',
  green:
    '  bg-green-300/20  text-green-400  border-green-300/10  hover:border-green-300/20',
  yellow:
    '  bg-yellow-300/20  text-yellow-400  border-yellow-300/10  hover:border-yellow-300/20',
  blue: '  bg-blue-400/20  text-blue-300  border-blue-400/10  hover:border-blue-400/20',
};

type Color = keyof typeof colors;
const ColorContext = createContext<Color>('transparent');

const tagStyles = tv({
  extend: focusRing,
  base: 'flex max-w-fit cursor-default items-center gap-1 rounded-full border px-3 py-0.5 text-xs transition',
  variants: {
    color: {
      transparent: '',
      gray: '',
      green: '',
      yellow: '',
      blue: '',
    },
    allowsRemoving: {
      true: 'pr-1',
    },
    isSelected: {
      true: 'border-transparent bg-neutral-200/80 text-white forced-color-adjust-none',
    },
    isDisabled: {
      true: 'border-white/20 bg-transparent text-neutral-400',
    },
  },
  compoundVariants: (Object.keys(colors) as Color[]).map((color) => ({
    isSelected: false,
    isDisabled: false,
    color,
    class: colors[color],
  })),
});

export interface TagGroupProps<T>
  extends Omit<AriaTagGroupProps, 'children'>,
    Pick<TagListProps<T>, 'items' | 'children' | 'renderEmptyState'> {
  color?: Color;
  label?: string;
  description?: string;
  errorMessage?: string;
}

export interface TagProps extends AriaTagProps {
  color?: Color;
}

export const TagGroup = <T extends object>({
  label,
  description,
  errorMessage,
  items,
  children,
  renderEmptyState,
  tagListProps,
  ...props
}: TagGroupProps<T> & {
  tagListProps?: Omit<
    TagListProps<T>,
    'items' | 'children' | 'renderEmptyState'
  > & { className?: string };
}) => {
  return (
    <AriaTagGroup
      {...props}
      className={twMerge('flex flex-col gap-1', props.className)}
    >
      <Label>{label}</Label>
      <ColorContext value={props.color || 'transparent'}>
        <TagList
          items={items}
          renderEmptyState={renderEmptyState}
          {...tagListProps}
          className={twMerge('flex flex-wrap gap-1', tagListProps?.className)}
        >
          {children}
        </TagList>
      </ColorContext>
      {description && <Description>{description}</Description>}
      {errorMessage && (
        <Text slot="errorMessage" className="text-sm text-red-600">
          {errorMessage}
        </Text>
      )}
    </AriaTagGroup>
  );
};

const removeButtonStyles = tv({
  extend: focusRing,
  base: 'flex cursor-default items-center justify-center rounded-full p-0.5 transition-[background-color] hover:bg-white/10 pressed:bg-white/20',
});

export const Tag = ({ children, color, ...props }: TagProps) => {
  const textValue = typeof children === 'string' ? children : undefined;
  const groupColor = useContext(ColorContext);

  return (
    <AriaTag
      textValue={textValue}
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        tagStyles({ ...renderProps, className, color: color || groupColor }),
      )}
    >
      {({ allowsRemoving }) => (
        <>
          {children}
          {allowsRemoving && (
            <Button slot="remove" className={removeButtonStyles}>
              <XIcon aria-hidden className="size-3" />
            </Button>
          )}
        </>
      )}
    </AriaTag>
  );
};
