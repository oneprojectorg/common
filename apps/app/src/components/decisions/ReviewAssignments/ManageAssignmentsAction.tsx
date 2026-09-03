'use client';

import { Button } from '@op/sense/Button';
import { Dialog, DialogTrigger } from '@op/sense/Dialog';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ManageAssignmentsDialogContent } from './ManageAssignmentsDialog';

interface ManageAssignmentsActionProps {
  processInstanceId: string;
  phaseId: string;
  reviewerProfileId: string;
}

/** The button needs no data, so the pool is only read once the dialog opens. */
export function ManageAssignmentsAction({
  processInstanceId,
  phaseId,
  reviewerProfileId,
}: ManageAssignmentsActionProps) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<Button />}>
        {t('Manage assignments')}
      </DialogTrigger>

      <ManageAssignmentsDialogContent
        processInstanceId={processInstanceId}
        phaseId={phaseId}
        reviewerProfileId={reviewerProfileId}
        onSaved={() => setIsOpen(false)}
      />
    </Dialog>
  );
}
