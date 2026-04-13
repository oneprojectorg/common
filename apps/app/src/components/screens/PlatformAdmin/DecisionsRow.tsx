'use client';

import { DATE_TIME_UTC_FORMAT } from '@/utils/formatting';
import type { RouterOutput } from '@op/api/client';
import { Menu } from '@op/ui/Menu';
import { OptionMenu } from '@op/ui/OptionMenu';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { TableCell } from '@op/ui/ui/table';
import { useFormatter } from 'next-intl';
import { Button } from 'react-aria-components';

type ListAllDecisionInstancesOutput =
  RouterOutput['platform']['admin']['listAllDecisionInstances'];
type DecisionInstance = ListAllDecisionInstancesOutput['items'][number];

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
  decision: DecisionInstance;
}) => {
  const format = useFormatter();
  const createdAt = decision.createdAt ? new Date(decision.createdAt) : null;
  const updatedAt = decision.updatedAt ? new Date(decision.updatedAt) : null;

  return (
    <>
      <TableCell className="text-sm font-normal text-neutral-black">
        {decision.name}
      </TableCell>
      <TableCell className="text-sm font-normal text-neutral-charcoal">
        {decision.processName}
      </TableCell>
      <TableCell className="text-sm font-normal text-neutral-charcoal">
        {decision.proposalCount}
      </TableCell>
      <TableCell className="text-sm font-normal text-neutral-charcoal">
        {decision.voterCount}
      </TableCell>
      <TableCell className="text-sm font-normal text-neutral-charcoal">
        {decision.status
          ? (STATUS_DISPLAY[decision.status] ?? decision.status)
          : '—'}
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
      <TableCell className="text-sm font-normal text-neutral-charcoal">
        {updatedAt ? (
          <TooltipTrigger>
            <Button className="cursor-default text-sm font-normal underline decoration-dotted underline-offset-2 outline-hidden">
              {format.dateTime(updatedAt, { dateStyle: 'medium' })}
            </Button>
            <Tooltip>
              {format.dateTime(updatedAt, DATE_TIME_UTC_FORMAT)}
            </Tooltip>
          </TooltipTrigger>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className="text-sm text-neutral-charcoal">
        <div className="flex justify-end">
          <OptionMenu variant="outline" size="medium">
            <Menu className="min-w-48 p-2" />
          </OptionMenu>
        </div>
      </TableCell>
    </>
  );
};
