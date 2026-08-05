'use client';

import { DATE_TIME_UTC_FORMAT } from '@/utils/formatting';
import type { AdminOrg } from '@op/api/encoders';
import { Button } from '@op/sense/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { TableCell } from '@op/sense/Table';
import { useFormatter } from 'next-intl';
import { useState } from 'react';
import { LuEllipsis } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { OrgMembersModal } from './OrgMembersModal';
import { TimestampTooltip } from './TimestampTooltip';

/** Renders table cells for an organization row - must be used inside a <TableRow> */
export const OrgsRowCells = ({ org }: { org: AdminOrg }) => {
  const format = useFormatter();
  const t = useTranslations();
  const createdAt = org.createdAt ? new Date(org.createdAt) : null;
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);

  return (
    <>
      <TableCell className="text-sm font-normal text-foreground">
        {org.profile?.name ?? '—'}
      </TableCell>
      <TableCell className="text-sm font-normal text-muted-foreground">
        {org.domain ?? '—'}
      </TableCell>
      <TableCell className="text-sm font-normal text-muted-foreground">
        {org.members?.length ?? 0}
      </TableCell>
      <TableCell className="text-sm font-normal text-muted-foreground">
        {createdAt ? (
          <TimestampTooltip
            className="text-sm font-normal"
            title={format.dateTime(createdAt, DATE_TIME_UTC_FORMAT)}
          >
            {format.dateTime(createdAt, { dateStyle: 'medium' })}
          </TimestampTooltip>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t('Organization options')}
                >
                  <LuEllipsis />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem onClick={() => setIsMembersModalOpen(true)}>
                {t('View members')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <OrgMembersModal
          org={org}
          isOpen={isMembersModalOpen}
          onOpenChange={setIsMembersModalOpen}
        />
      </TableCell>
    </>
  );
};
