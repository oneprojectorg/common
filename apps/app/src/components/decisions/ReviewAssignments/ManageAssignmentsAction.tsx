'use client';

import { Button } from '@op/sense/Button';
import { Dialog, DialogTrigger } from '@op/sense/Dialog';
import { useState } from 'react';
import { LuPencil, LuUserPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ManageAssignmentsDialogContent } from './ManageAssignmentsDialog';

interface ManageAssignmentsActionProps {
  processInstanceId: string;
  phaseId: string;
  reviewerProfileId: string;
  /** `assign` is the empty queue's call to action; `edit` sits beside the reviewer's name. */
  intent?: 'edit' | 'assign';
}

/** The button needs no data, so both reads only run once the dialog opens. */
export function ManageAssignmentsAction({
  processInstanceId,
  phaseId,
  reviewerProfileId,
  intent = 'edit',
}: ManageAssignmentsActionProps) {
  const t = useTranslations('decisions.review');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {intent === 'assign' ? (
        <DialogTrigger render={<Button />}>
          <LuUserPlus data-icon="inline-start" />
          {t('assignProposalsAction')}
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="outline" />}>
          <LuPencil data-icon="inline-start" />
          {t('editAssignmentsAction')}
        </DialogTrigger>
      )}

      <ManageAssignmentsDialogContent
        processInstanceId={processInstanceId}
        phaseId={phaseId}
        reviewerProfileId={reviewerProfileId}
        onSaved={() => setIsOpen(false)}
      />
    </Dialog>
  );
}
