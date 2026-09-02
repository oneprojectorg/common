'use client';

import { Button } from '@op/sense/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
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
 * "Add field" button with a menu of the available field types, grouped by
 * category. This is the only entry point for the location field: it is
 * single-instance with a fixed key, so the field card's Type select excludes
 * it and nothing can be converted into one.
 */
export function AddFieldMenu({ onAddField, disabledTypes }: AddFieldMenuProps) {
  const t = useTranslations();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" className="w-full" />}
      >
        <LuPlus className="size-4" />
        {t('Add field')}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        {FIELD_CATEGORIES.map((category, categoryIndex) => (
          <Fragment key={category.id}>
            {categoryIndex > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t(category.labelKey)}</DropdownMenuLabel>
              {category.types.map((type) => {
                const { icon: Icon, labelKey } = FIELD_TYPE_REGISTRY[type];

                return (
                  <DropdownMenuItem
                    key={type}
                    disabled={disabledTypes?.includes(type)}
                    onClick={() => onAddField(type)}
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    {t(labelKey)}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
