'use client';

import { DATE_TIME_UTC_FORMAT } from '@/utils/formatting';
import type { AdminDecisionInstance } from '@op/api/encoders';
import { Menu, MenuItem } from '@op/ui/Menu';
import { Modal, ModalBody, ModalHeader } from '@op/ui/Modal';
import { OptionMenu } from '@op/ui/OptionMenu';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { TableCell } from '@op/ui/ui/table';
import { useFormatter } from 'next-intl';
import { useState } from 'react';
import { Button } from 'react-aria-components';

import { useTranslations } from '@/lib/i18n';

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
  const createdAt = decision.createdAt ? new Date(decision.createdAt) : null;
  const phaseEndDate = decision.currentPhase?.endDate
    ? new Date(decision.currentPhase.endDate)
    : null;
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);

  return (
    <>
      <TableCell className="text-sm font-normal text-neutral-black">
        {decision.name}
      </TableCell>
      <TableCell className="text-sm font-normal text-neutral-charcoal">
        {decision.currentPhase ? (
          <div className="flex flex-col">
            <span>
              {decision.currentPhase.name ?? decision.currentPhase.id}
            </span>
            {phaseEndDate ? (
              <span className="text-xs text-neutral-gray4">
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
      <TableCell className="text-sm font-normal text-neutral-charcoal">
        {decision.stewardName ?? '—'}
      </TableCell>
      <TableCell className="text-sm font-normal text-neutral-charcoal">
        {decision.proposalCount}
      </TableCell>
      <TableCell className="text-sm font-normal text-neutral-charcoal">
        {decision.participantCount}
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
      <TableCell className="text-sm text-neutral-charcoal">
        <div className="flex justify-end">
          <OptionMenu variant="outline" size="medium">
            <Menu className="min-w-48 p-2">
              <MenuItem
                key="view-instance-data"
                onAction={() => setIsDataModalOpen(true)}
                className="px-3 py-1"
              >
                {t('View instance data')}
              </MenuItem>
            </Menu>
          </OptionMenu>
        </div>
        <InstanceDataModal
          name={decision.name}
          instanceData={decision.instanceData}
          isOpen={isDataModalOpen}
          onOpenChange={setIsDataModalOpen}
        />
      </TableCell>
    </>
  );
};

const InstanceDataModal = ({
  name,
  instanceData,
  isOpen,
  onOpenChange,
}: {
  name: string;
  instanceData: unknown;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) => {
  const t = useTranslations();

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
      <ModalHeader>{t('Instance data for {name}', { name })}</ModalHeader>
      <ModalBody className="pb-6">
        <pre className="bg-neutral-gray0 max-h-[60vh] overflow-auto rounded-lg p-4 text-xs">
          {JSON.stringify(instanceData, null, 2)}
        </pre>
      </ModalBody>
    </Modal>
  );
};
