'use client';

import { DATE_TIME_UTC_FORMAT } from '@/utils/formatting';
import type { AdminDecisionInstance } from '@op/common/client';
import { Button } from '@op/sense/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { TableCell } from '@op/sense/Table';
import { useFormatter } from 'next-intl';
import { LuEllipsis } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { useRouter } from '@/lib/i18n/routing';

import { TimestampTooltip } from './TimestampTooltip';

const STATUS_DISPLAY: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/** Renders table cells for a decision instance row - must be used inside a <TableRow> */
export const DecisionsRowCells = ({
  decision,
}: {
  decision: AdminDecisionInstance;
}) => {
  const format = useFormatter();
  const t = useTranslations();
  const router = useRouter();
  const createdAt = decision.createdAt ? new Date(decision.createdAt) : null;
  const phaseEndDate = decision.currentPhase?.endDate
    ? new Date(decision.currentPhase.endDate)
    : null;
  return (
    <>
      <TableCell>
        <bdi>{decision.name}</bdi>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {decision.currentPhase ? (
          <div className="flex flex-col">
            <span>
              {decision.currentPhase.name ?? decision.currentPhase.id}
            </span>
            {phaseEndDate ? (
              <span className="text-xs text-muted-foreground">
                {t('Ends {date}', {
                  date: format.dateTime(phaseEndDate, { dateStyle: 'medium' }),
                })}
              </span>
            ) : null}
          </div>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {decision.stewardName ?? '—'}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {decision.totalProposalCount > decision.proposalCount ? (
          <TimestampTooltip
            title={t(
              '{nonDraft} non-draft proposals, {total} total including drafts',
              {
                nonDraft: decision.proposalCount,
                total: decision.totalProposalCount,
              },
            )}
          >
            {decision.proposalCount} ({decision.totalProposalCount})
          </TimestampTooltip>
        ) : (
          decision.proposalCount
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {decision.participantCount}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {decision.status
          ? (STATUS_DISPLAY[decision.status] ?? decision.status)
          : '—'}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {createdAt ? (
          <TimestampTooltip
            title={format.dateTime(createdAt, DATE_TIME_UTC_FORMAT)}
          >
            {format.dateTime(createdAt, { dateStyle: 'medium' })}
          </TimestampTooltip>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell>
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t('Decision options')}
                >
                  <LuEllipsis />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem
                onClick={() => router.push(`/admin/decisions/${decision.id}`)}
              >
                {t('View details')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </>
  );
};
