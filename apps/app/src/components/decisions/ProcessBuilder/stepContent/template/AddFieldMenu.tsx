'use client';

import { Button } from '@op/ui-next/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@op/ui-next/Menu';
import { Fragment } from 'react';
import { LuPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { FieldType } from '../../../proposalTemplate';
import { FIELD_CATEGORIES, FIELD_TYPE_REGISTRY } from './fieldRegistry';

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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button color="neutral" className="w-full justify-center gap-2">
            <LuPlus className="size-4" />
            {t('Add field')}
          </Button>
        }
      />
      <DropdownMenuContent
        align="start"
        className="w-56"
        aria-label={t('Add field')}
      >
        {FIELD_CATEGORIES.map((category, categoryIndex) => (
          <Fragment key={category.id}>
            {categoryIndex > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-4 py-1 text-xs font-medium text-neutral-gray4">
                {t(category.labelKey)}
              </DropdownMenuLabel>
              {category.types.map((type) => {
                const config = FIELD_TYPE_REGISTRY[type];
                const Icon = config.icon;
                return (
                  <DropdownMenuItem
                    key={type}
                    onClick={() => onAddField(type)}
                    className="gap-2"
                  >
                    <Icon className="size-4 text-neutral-gray4" />
                    {t(config.labelKey)}
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
