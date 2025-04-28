'use client';

import {
  GridList as AriaGridList,
  GridListItem as AriaGridListItem,
  Button,
} from 'react-aria-components';
import type { GridListItemProps, GridListProps } from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { composeTailwindRenderProps, focusRing } from '../utils';
import { Checkbox } from './Checkbox';

export const GridList = <T extends object>({
  children,
  ...props
}: GridListProps<T>) => {
  return (
    <AriaGridList
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        '-neutral-400 relative overflow-auto rounded-lg border',
      )}
    >
      {children}
    </AriaGridList>
  );
};

const itemStyles = tv({
  extend: focusRing,
  base: '-neutral-300 relative -mb-px flex cursor-default select-none gap-3 border-y border-transparent px-3 py-2 text-sm text-neutral-800 -outline-offset-2 first:rounded-t-md first:border-t-0 last:mb-0 last:rounded-b-md last:border-b-0',
  variants: {
    isSelected: {
      false: 'hover:bg-neutral-300/60',
      true: 'z-20 border-y-neutral-100 bg-neutral-300/30 hover:bg-neutral-300/40',
    },
    isDisabled: {
      true: 'z-10 text-neutral-400',
    },
  },
});

export const GridListItem = ({ children, ...props }: GridListItemProps) => {
  const textValue = typeof children === 'string' ? children : undefined;

  return (
    <AriaGridListItem textValue={textValue} {...props} className={itemStyles}>
      {({ selectionMode, selectionBehavior, allowsDragging }) => (
        <>
          {/* Add elements for drag and drop and selection. */}
          {allowsDragging && <Button slot="drag">≡</Button>}
          {selectionMode === 'multiple' && selectionBehavior === 'toggle' && (
            <Checkbox slot="selection" />
          )}
          {children}
        </>
      )}
    </AriaGridListItem>
  );
};
