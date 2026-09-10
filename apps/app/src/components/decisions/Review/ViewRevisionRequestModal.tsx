'use client';

import { useReviewForm } from './ReviewFormContext';
import {
  RevisionRequestDialog,
  type ViewedRevisionRequest,
} from './RevisionRequestDialog';

interface ViewRevisionRequestModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Defaults to every request still open on the proposal. */
  requests?: Array<ViewedRevisionRequest>;
}

/**
 * The reviewer's view of the revision requests on a proposal: adds the marking
 * and the cancelling of their own. Requests are anonymous, so no other
 * reviewer is named.
 */
export function ViewRevisionRequestModal({
  isOpen,
  onOpenChange,
  requests,
}: ViewRevisionRequestModalProps) {
  const {
    openRevisionRequests,
    ownRevisionRequest,
    assignment,
    cancelRevisionRequest,
    isCancellingRevision,
  } = useReviewForm();

  return (
    <RevisionRequestDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      requests={requests ?? openRevisionRequests}
      ownAssignmentId={assignment.id}
      onCancelOwn={
        ownRevisionRequest !== null ? () => cancelRevisionRequest() : undefined
      }
      isCancelling={isCancellingRevision}
    />
  );
}
