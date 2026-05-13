'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { Button } from '@op/ui/Button';
import { Menu, MenuItem, MenuSeparator, MenuTrigger } from '@op/ui/Menu';
import { Fragment } from 'react';
import { LuPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { FieldType } from '../../../proposalTemplate';
import { FIELD_CATEGORIES, FIELD_TYPE_REGISTRY } from './fieldRegistry';

interface AddFieldMenuProps {
  onAddField: (type: FieldType) => void;
  /** Field types that cannot currently be added (e.g. single-instance fields). */
  disabledTypes?: FieldType[];
}

/**
 * Button with popover menu for adding new fields to the form builder.
 * Fields are organized by category as shown in the Figma mockup.
 */
export function AddFieldMenu({ onAddField, disabledTypes }: AddFieldMenuProps) {
  const t = useTranslations();
  const gisMapsEnabled = useFeatureFlag('gis_maps');

  // The location field type lives behind the `gis_maps` flag. When it's off,
  // strip it from the menu and drop any category left empty (e.g. "Map").
  const categories = gisMapsEnabled
    ? FIELD_CATEGORIES
    : FIELD_CATEGORIES.map((category) => ({
        ...category,
        types: category.types.filter((type) => type !== 'location'),
      })).filter((category) => category.types.length > 0);

  return (
    <MenuTrigger>
      <Button color="neutral" className="w-full justify-center gap-2">
        <LuPlus className="size-4" />
        {t('Add field')}
      </Button>
      <Menu
        onAction={(key) => onAddField(key as FieldType)}
        aria-label={t('Add field')}
        placement="bottom start"
        popoverClassName="w-56"
      >
        {categories.map((category, categoryIndex) => (
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
                <MenuItem
                  key={type}
                  id={type}
                  className="gap-2"
                  isDisabled={disabledTypes?.includes(type)}
                >
                  <Icon className="size-4 text-neutral-gray4" />
                  {t(config.labelKey)}
                </MenuItem>
              );
            })}
          </Fragment>
        ))}
      </Menu>
    </MenuTrigger>
  );
}
