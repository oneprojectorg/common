'use client';

import { Button } from '@op/sense/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { LuEllipsis } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

export const ResourceOverflowMenu = ({
  onDelete,
}: {
  onDelete: () => void;
}) => {
  const t = useTranslations();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t('Resource options')}
          >
            <LuEllipsis className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent side="bottom" align="end" className="min-w-36">
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          {t('Delete resource')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
