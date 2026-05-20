'use client';

import { Menu, MenuItem } from '@op/ui/Menu';
import { OptionMenu } from '@op/ui/OptionMenu';

import { useTranslations } from '@/lib/i18n';

export const ResourceOverflowMenu = ({
  onDelete,
}: {
  onDelete: () => void;
}) => {
  const t = useTranslations();

  return (
    <OptionMenu aria-label={t('Resource options')} variant="ghost" size="small">
      <Menu className="min-w-36 p-2">
        <MenuItem
          key="delete"
          onAction={onDelete}
          className="text-functional-red"
        >
          {t('Delete resource')}
        </MenuItem>
      </Menu>
    </OptionMenu>
  );
};
