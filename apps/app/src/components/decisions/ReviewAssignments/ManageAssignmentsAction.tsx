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
  // Unmounting on close would cut the exit animation, so the content outlives
  // `isOpen` until Base UI reports the transition finished.
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
