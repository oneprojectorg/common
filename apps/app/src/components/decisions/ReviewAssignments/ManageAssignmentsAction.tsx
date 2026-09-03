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

/** The button needs no data, so the pool is only fetched once the dialog opens. */
export function ManageAssignmentsAction({
  processInstanceId,
  phaseId,
  reviewerProfileId,
}: ManageAssignmentsActionProps) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  // Outlives `isOpen`: unmounting on close would cut the exit animation.
  const [isMounted, setIsMounted] = useState(false);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (open) {
          setIsMounted(true);
        }
      }}
      onOpenChangeComplete={(open) => {
        if (!open) {
          setIsMounted(false);
        }
      }}
    >
      <DialogTrigger render={<Button />}>
        {t('Manage assignments')}
      </DialogTrigger>

      {isMounted ? (
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
