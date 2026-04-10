'use client';

import { DATE_TIME_UTC_FORMAT } from '@/utils/formatting';
import type { AdminOrg } from '@op/api/encoders';
import { Menu, MenuItem } from '@op/ui/Menu';
import { OptionMenu } from '@op/ui/OptionMenu';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { cn } from '@op/ui/utils';
import { useFormatter } from 'next-intl';
import { useState } from 'react';
import { Button } from 'react-aria-components';

import { useTranslations } from '@/lib/i18n';

import { OrgMembersModal } from './OrgMembersModal';
import { ORGS_TABLE_GRID, ORGS_TABLE_ROW } from './tableStyles';

export const OrgsRow = ({ org }: { org: AdminOrg }) => {
  const format = useFormatter();
  const t = useTranslations();
  const createdAt = org.createdAt ? new Date(org.createdAt) : null;
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          'hover:bg-neutral-gray0 transition-colors',
          ORGS_TABLE_ROW,
          ORGS_TABLE_GRID,
        )}
      >
        <div className="flex items-center text-sm font-normal text-neutral-black">
          {org.profile?.name ?? '—'}
        </div>
        <div className="flex items-center text-sm font-normal text-neutral-charcoal">
          {org.domain ?? '—'}
        </div>
        <div className="flex items-center text-sm font-normal text-neutral-charcoal">
          {org.members?.length ?? 0}
        </div>
        <div className="flex items-center text-sm font-normal text-neutral-charcoal">
          {createdAt ? (
            <TooltipTrigger>
              <Button className="cursor-default text-sm font-normal underline decoration-dotted underline-offset-2 outline-hidden">
                {format.dateTime(createdAt, { dateStyle: 'medium' })}
              </Button>
              <Tooltip>
                {format.dateTime(createdAt, DATE_TIME_UTC_FORMAT)}
              </Tooltip>
            </TooltipTrigger>
          ) : (
            '—'
          )}
        </div>
        <div className="flex items-center justify-end pr-1 text-sm text-neutral-charcoal">
          <OptionMenu variant="outline" size="medium">
            <Menu className="min-w-48 p-2">
              <MenuItem
                key="view-members"
                onAction={() => setIsMembersModalOpen(true)}
                className="px-3 py-1"
              >
                {t('View members')}
              </MenuItem>
            </Menu>
          </OptionMenu>
        </div>
      </div>
      <OrgMembersModal
        org={org}
        isOpen={isMembersModalOpen}
        onOpenChange={setIsMembersModalOpen}
      />
    </>
  );
};
