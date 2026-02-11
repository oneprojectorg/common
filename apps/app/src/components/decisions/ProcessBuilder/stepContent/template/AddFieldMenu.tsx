'use client';

import { Button } from '@op/ui/Button';
import { Menu, MenuItem, MenuSeparator, MenuTrigger } from '@op/ui/Menu';
import { Popover } from '@op/ui/Popover';
import { Fragment } from 'react';
import { LuPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { FIELD_CATEGORIES, FIELD_TYPE_REGISTRY } from './fieldRegistry';
import type { FieldType } from './types';

interface AddFieldMenuProps {
  onAddField: (type: FieldType) => void;
}

/**
 * Button with popover menu for adding new fields to the form builder.
 * Fields are organized by category as shown in the Figma mockup.
 */
export function AddFieldMenu({ onAddField }: AddFieldMenuProps) {
  const t = useTranslations();

  return (
    <MenuTrigger>
      <Button color="neutral" className="w-full justify-center gap-2">
        <LuPlus className="size-4" />
        {t('Add field')}
      </Button>
      <Popover placement="bottom start" className="w-56">
        <Menu
          onAction={(key) => onAddField(key as FieldType)}
          aria-label={t('Add field')}
        >
          {FIELD_CATEGORIES.map((category, categoryIndex) => (
            <Fragment key={category.id}>
              {categoryIndex > 0 && <MenuSeparator />}
              <MenuItem
                id={`header-${category.id}`}
                isDisabled
                className="px-4 py-1 text-xs font-medium text-neutral-gray4"
              >
                {t(category.labelKey)}
              </MenuItem>
              {category.types.map((type) => {
                const config = FIELD_TYPE_REGISTRY[type];
                const Icon = config.icon;
                return (
                  <MenuItem key={type} id={type} className="gap-2">
                    <Icon className="size-4 text-neutral-gray4" />
                    {t(config.labelKey)}
                  </MenuItem>
                );
              })}
            </Fragment>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
