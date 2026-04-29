'use client';

import type { MenuItemProps } from 'react-aria-components';

import { MenuItem as TakiMenuItem } from './ui/menu';

export {
  Menu,
  MenuItem,
  MenuSection,
  MenuSeparator,
  MenuTrigger,
} from './ui/menu';
export type { MenuSectionProps } from './ui/menu';

/** Compat alias for the legacy basic-styled menu item. Same as Taki MenuItem. */
export const MenuItemSimple = (props: MenuItemProps) => (
  <TakiMenuItem {...props} />
);
