'use client';

import {
  Menu as AriaMenu,
  type MenuItemProps,
  type MenuProps,
} from 'react-aria-components';

import { cn } from '../lib/utils';

export { MenuItem, MenuSection, MenuSeparator, MenuTrigger } from './ui/menu';
export type { MenuSectionProps } from './ui/menu';

/**
 * Inline Menu — styled AriaMenu only, no Popover wrap. Consumers compose
 * their own Popover (or render the Menu directly inside a Modal/Sheet for
 * mobile-style drawers). This matches the legacy @op/ui/Menu contract;
 * Taki's ./ui/menu Menu wraps in Popover and is unsuitable when the
 * caller already provides one (e.g. inside MenuTrigger > Popover).
 */
export function Menu<T extends object>(props: MenuProps<T>) {
  return (
    <AriaMenu
      {...props}
      className={cn(
        'max-h-[inherit] overflow-auto outline-0',
        typeof props.className === 'string' ? props.className : undefined,
      )}
    />
  );
}

/** Compat alias for the legacy basic-styled menu item. */
export { MenuItem as MenuItemSimple } from './ui/menu';

export type { MenuItemProps };
