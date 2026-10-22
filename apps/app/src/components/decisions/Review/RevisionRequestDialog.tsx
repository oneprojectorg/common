'use client';

import { useRelativeTime } from '@op/hooks';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@op/sense/AlertDialog';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

/** `assignmentId` is absent in the author-notes read, which is anonymous. */
export interface ViewedRevisionRequest {
  id: string;
  assignmentId?: string | null;
  requestComment: string;
  requestedAt: string | null;
}

interface RevisionRequestDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  requests: Array<ViewedRevisionRequest>;
  ownAssignmentId?: string | null;
  /** Absent → no cancel action, e.g. a past request or an admin reader. */
  onCancelOwn?: () => void;
  isCancelling?: boolean;
}

/** Requests are anonymous, so no reviewer is named. */
export function RevisionRequestDialog({
  isOpen,
  onOpenChange,
  requests,
  ownAssignmentId,
  onCancelOwn,
  isCancelling,
}: RevisionRequestDialogProps) {
  const t = useTranslations();
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);

  if (requests.length === 0) {
    return null;
  }

  const handleConfirmCancel = () => {
    onCancelOwn?.();
    setIsCancelConfirmOpen(false);
    if (requests.length === 1) {
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            {/* The noun: RequestRevisionModal owns the verb phrase. */}
            <DialogTitle>
              {requests.length === 1
                ? t('decisions.review.revisionRequestHeading')
                : t('decisions.review.revisionRequestsHeading')}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 px-6 py-6">
            {requests.map((request) => (
              <RevisionRequestCard
                key={request.id}
                request={request}
                isOwn={
                  ownAssignmentId != null &&
                  request.assignmentId === ownAssignmentId
                }
                canCancel={onCancelOwn !== undefined}
                onCancel={() => setIsCancelConfirmOpen(true)}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isCancelConfirmOpen}
        onOpenChange={setIsCancelConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('decisions.review.cancelRevisionRequestTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('decisions.review.cancelRevisionRequestDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('decisions.review.keepRequestAction')}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmCancel}
              loading={isCancelling}
            >
              {t('decisions.review.cancelRequestAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RevisionRequestCard({
  request,
  isOwn,
  canCancel,
  onCancel,
}: {
  request: ViewedRevisionRequest;
  isOwn: boolean;
  canCancel: boolean;
  onCancel: () => void;
}) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <p dir="auto" className="text-base whitespace-pre-wrap">
        {request.requestComment}
      </p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        {request.requestedAt ? (
          <SentLine sentAt={request.requestedAt} isOwn={isOwn} />
        ) : isOwn ? (
          <span>{t('decisions.review.yourRequestHeading')}</span>
        ) : null}
        {isOwn && canCancel && (
          <Button
            variant="link"
            size="inline"
            className="text-sm underline"
            onClick={onCancel}
          >
            {t('decisions.review.cancelRequestAction')}
          </Button>
        )}
      </div>
    </div>
  );
}

function SentLine({ sentAt, isOwn }: { sentAt: string; isOwn: boolean }) {
  const t = useTranslations();
  const timeAgo = useRelativeTime(sentAt, { style: 'long' });

  return (
    <span>
      {isOwn
        ? t('decisions.review.yourRequestSentTimeAgo', { timeAgo })
        : t('decisions.review.sentTimeAgo', { timeAgo })}
    </span>
  );
}
