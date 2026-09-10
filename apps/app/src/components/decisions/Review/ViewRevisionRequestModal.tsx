'use client';

import type { ProposalReviewRequest } from '@op/common/client';
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

interface ViewRevisionRequestModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The requests to list. Defaults to every request still open on the
   * proposal; a caller with a narrower subject (one author note answering one
   * request) passes its own list instead.
   */
  requests?: Array<ProposalReviewRequest>;
}

/**
 * Lists the revision requests on a proposal. Requests are anonymous, so no
 * card names its reviewer — the viewer's own card is the only one marked, and
 * the only one that can be cancelled.
 */
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

  // The reviewer's own request leads the list — it is the only one they can
  // act on, so it must not be buried under other reviewers' requests.
  const ordered = [...listed].sort((a, b) => {
    const aIsOwn = a.assignmentId === assignment.id ? 0 : 1;
    const bIsOwn = b.assignmentId === assignment.id ? 0 : 1;
    return aIsOwn - bIsOwn;
  });

  const canCancel = ownRevisionRequest !== null;

  const handleConfirmCancel = () => {
    cancelRevisionRequest();
    setIsCancelConfirmOpen(false);
    // Nothing left to read once the only request is withdrawn.
    if (ordered.length === 1) {
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
              {ordered.length === 1
                ? t('Revision request')
                : t('Revision requests')}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 px-6 py-6">
            {ordered.map((request) => (
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
  request: ProposalReviewRequest;
  isOwn: boolean;
  /** The own card only offers cancel while the request is still open. */
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
