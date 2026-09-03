'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { Button } from '@op/sense/Button';
import { Dialog, DialogTrigger } from '@op/sense/Dialog';
import { Suspense, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  ManageAssignmentsDialogContent,
  ManageAssignmentsDialogMessage,
  ManageAssignmentsDialogSkeleton,
} from './ManageAssignmentsDialog';

interface ManageAssignmentsActionProps {
  processInstanceId: string;
  phaseId: string;
  reviewerProfileId: string;
}

/**
 * The button needs no data, so the phase-wide proposal pool is only fetched
 * once the dialog opens — it is the heaviest read on this screen.
 */
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

      {isOpen ? (
        <APIErrorBoundary
          fallbacks={{
            default: () => (
              <ManageAssignmentsDialogMessage>
                {t('Please refresh the page to try again.')}
              </ManageAssignmentsDialogMessage>
            ),
          }}
        >
          <Suspense fallback={<ManageAssignmentsDialogSkeleton />}>
            <ManageAssignmentsDialogContent
              processInstanceId={processInstanceId}
              phaseId={phaseId}
              reviewerProfileId={reviewerProfileId}
              onSaved={() => setIsOpen(false)}
            />
          </Suspense>
        </APIErrorBoundary>
      ) : null}
    </Dialog>
  );
}
