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

import { useReviewForm } from './ReviewFormContext';

/**
 * Only the fields the cards render. The author-notes accordion passes past
 * requests read through `listProposalRevisionNotes`, which never selects an
 * assignment id — a request with no id can never be the viewer's own, which is
 * what the anonymous author-note view wants.
 */
export interface ListedRevisionRequest {
  id: string;
  assignmentId?: string | null;
  requestComment: string;
  requestedAt: string | null;
}

interface ViewRevisionRequestModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Defaults to every request still open on the proposal. */
  requests?: Array<ListedRevisionRequest>;
}

/** Requests are anonymous; only the viewer's own card is marked and cancellable. */
export function ViewRevisionRequestModal({
  isOpen,
  onOpenChange,
  requests,
}: ViewRevisionRequestModalProps) {
  const t = useTranslations();
  const {
    openRevisionRequests,
    ownRevisionRequest,
    assignment,
    cancelRevisionRequest,
    isCancellingRevision,
  } = useReviewForm();
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);

  const listed = requests ?? openRevisionRequests;

  if (listed.length === 0) {
    return null;
  }

  const canCancel = ownRevisionRequest !== null;

  const handleConfirmCancel = () => {
    cancelRevisionRequest();
    setIsCancelConfirmOpen(false);
    if (listed.length === 1) {
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            {/* This dialog *views* existing requests — the noun. "Request
                Revision" is the verb phrase that titles RequestRevisionModal,
                which creates one. */}
            <DialogTitle>
              {listed.length === 1
                ? t('Revision request')
                : t('Revision requests')}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 px-6 py-6">
            {listed.map((request) => (
              <RevisionRequestCard
                key={request.id}
                request={request}
                isOwn={request.assignmentId === assignment.id}
                canCancel={canCancel}
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
            <AlertDialogTitle>{t('Cancel revision request?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "Your request will be withdrawn and the author won't see it. Other reviewers' requests aren't affected.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Keep request')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmCancel}
              loading={isCancellingRevision}
            >
              {t('Cancel request')}
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
  request: ListedRevisionRequest;
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
          <span>{t('Your request')}</span>
        ) : null}
        {isOwn && canCancel && (
          <Button
            variant="link"
            size="inline"
            className="text-sm underline"
            onClick={onCancel}
          >
            {t('Cancel request')}
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
        ? t('Your request • Sent {timeAgo}', { timeAgo })
        : t('Sent {timeAgo}', { timeAgo })}
    </span>
  );
}
