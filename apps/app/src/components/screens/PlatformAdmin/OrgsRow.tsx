'use client';

import { DATE_TIME_UTC_FORMAT } from '@/utils/formatting';
import type { AdminOrg } from '@op/api/encoders';
import { Menu, MenuItem } from '@op/ui/Menu';
import { OptionMenu } from '@op/ui/OptionMenu';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { TableCell } from '@op/ui/ui/table';
import { useFormatter } from 'next-intl';
import { useState } from 'react';
import { Button } from 'react-aria-components';

import { useTranslations } from '@/lib/i18n';

import { OrgMembersModal } from './OrgMembersModal';

/** Renders table cells for an organization row - must be used inside a <TableRow> */
export const OrgsRowCells = ({ org }: { org: AdminOrg }) => {
  const format = useFormatter();
  const t = useTranslations();
  const createdAt = org.createdAt ? new Date(org.createdAt) : null;
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);

  return (
    <>
      <TableCell className="text-sm font-normal text-neutral-black">
        {org.profile?.name ?? '—'}
      </TableCell>
      <TableCell className="text-sm font-normal text-neutral-charcoal">
        {org.domain ?? '—'}
      </TableCell>
      <TableCell className="text-sm font-normal text-neutral-charcoal">
        {org.members?.length ?? 0}
      </TableCell>
      <TableCell className="text-sm font-normal text-neutral-charcoal">
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
      </TableCell>
      <TableCell className="text-right text-sm text-neutral-charcoal">
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
        <OrgMembersModal
          org={org}
          isOpen={isMembersModalOpen}
          onOpenChange={setIsMembersModalOpen}
        />
      </TableCell>
    </>
  );
};
