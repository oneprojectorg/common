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
  transparent: '',
  gray: '',
  green: '',
  yellow: '',
  blue: '',
};

type Color = keyof typeof colors;
const ColorContext = createContext<Color>('transparent');

const tagStyles = tv({
  extend: focusRing,
  base: 'gap-1 p-2 sm:rounded flex max-w-fit cursor-default items-center rounded-sm bg-neutral-gray1 leading-none',
  variants: {
    color: {
      transparent: '',
      gray: '',
      green: '',
      yellow: '',
      blue: '',
    },
    allowsRemoving: {
      true: '',
    },
    isSelected: {
      true: '',
    },
    isDisabled: {
      true: '',
    },
  },
  compoundVariants: (Object.keys(colors) as Color[]).map((color) => ({
    isSelected: false,
    isDisabled: false,
    color,
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
      className={twMerge('gap-1 flex flex-col', props.className)}
    >
      {label ? <Label>{label}</Label> : null}
      <ColorContext value={props.color || 'transparent'}>
        <TagList
          items={items}
          renderEmptyState={renderEmptyState}
          {...tagListProps}
          className={twMerge('gap-2 flex flex-wrap', tagListProps?.className)}
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
  base: 'p-0.5 flex cursor-default items-center justify-center rounded-full transition-[background-color] hover:bg-white/10 pressed:bg-white/20',
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
