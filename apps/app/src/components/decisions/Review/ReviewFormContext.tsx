'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import {
  type ProposalReview,
  type ProposalReviewAssignment,
  type ProposalReviewRequest,
  ProposalReviewRequestState,
  type RubricTemplateSchema,
  schemaValidator,
} from '@op/common/client';
import { useDebouncedCallback } from '@op/hooks';
import { toast } from '@op/ui/Toast';
import { notFound } from 'next/navigation';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useRouter, useTranslations } from '@/lib/i18n';

const AUTOSAVE_DEBOUNCE_MS = 1000;

interface ReviewFormState {
  /** Rubric answers keyed by criterion id; validated against the rubricTemplate. */
  values: Record<string, unknown>;
  /** Optional free-text rationale per criterion id (always optional). */
  rationales: Record<string, string>;
  /** Optional free-text feedback shown to the author after the review phase. */
  overallComment: string;
  canSubmit: boolean;
  isSubmitting: boolean;
  isSubmitted: boolean;
  isPausedForRevision: boolean;
  revisionRequest: ProposalReviewRequest | null;
  isOwnRevisionRequest: boolean;
  canRequestRevision: boolean;
  rubricTemplate: RubricTemplateSchema;
  review: ProposalReview | null;
  assignment: ProposalReviewAssignment;
  handleValueChange: (key: string, value: unknown) => void;
  handleRationaleChange: (key: string, value: string) => void;
  handleOverallCommentChange: (value: string) => void;
  handleSubmit: () => void;
  requestRevision: (comment: string) => void;
  cancelRevisionRequest: () => void;
  isRequestingRevision: boolean;
  isCancellingRevision: boolean;
}

const ReviewFormContext = createContext<ReviewFormState | null>(null);

export function useReviewForm(): ReviewFormState {
  const ctx = useContext(ReviewFormContext);
  if (!ctx) {
    throw new Error('useReviewForm must be used within ReviewFormProvider');
  }
  return ctx;
}

export function ReviewFormProvider(props: {
  assignmentId: string;
  decisionSlug: string;
  children: ReactNode;
}) {
  return (
    <APIErrorBoundary fallbacks={{ 404: () => notFound() }}>
      <ReviewFormProviderInner {...props} />
    </APIErrorBoundary>
  );
}

function ReviewFormProviderInner({
  assignmentId,
  decisionSlug,
  children,
}: {
  assignmentId: string;
  decisionSlug: string;
  children: ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();

  const [reviewAssignment] = trpc.decision.getReviewAssignment.useSuspenseQuery(
    { assignmentId },
    // 'always' forces one fetch per mount, which is what registers the
    // realtime channel via the tRPC client link.
    { refetchOnMount: 'always' },
  );

  const { rubricTemplate, review, revisionRequest, assignment } =
    reviewAssignment;

  if (!rubricTemplate) {
    throw new Error(`Review assignment ${assignmentId} has no rubric template`);
  }

  const [proposalRevisionRequestList] =
    trpc.decision.listProposalRevisionRequests.useSuspenseQuery(
      {
        proposalId: assignment.proposal.id,
        states: [ProposalReviewRequestState.REQUESTED],
      },
      { refetchOnMount: 'always' },
    );

  const hasAnyOpenRevisionRequest =
    proposalRevisionRequestList.revisionRequests.length > 0;

  // Only trust the per-assignment request when it is still REQUESTED — a
  // locally cached CANCELLED/RESUBMITTED entry must not gate the UI.
  const ownRevisionRequest =
    revisionRequest?.state === ProposalReviewRequestState.REQUESTED
      ? revisionRequest
      : null;

  // Prefer the reviewer's own request; otherwise surface the earliest
  // outstanding request from any other reviewer on the same proposal so
  // every reviewer sees the same paused state + feedback.
  const effectiveRevisionRequest =
    ownRevisionRequest ??
    proposalRevisionRequestList.revisionRequests[0]?.revisionRequest ??
    null;
  const isOwnRevisionRequest = !!ownRevisionRequest;

  const [values, setValues] = useState<Record<string, unknown>>(
    review?.reviewData.answers ?? {},
  );
  const [rationales, setRationales] = useState<Record<string, string>>(
    review?.reviewData.rationales ?? {},
  );
  const [overallComment, setOverallComment] = useState<string>(
    review?.overallComment ?? '',
  );
  const isSubmitted = review?.state === 'submitted';
  const isPausedForRevision = hasAnyOpenRevisionRequest;
  const canRequestRevision = !isSubmitted && !hasAnyOpenRevisionRequest;

  const submitReview = trpc.decision.submitReview.useMutation({
    onSuccess: () => {
      toast.success({ message: t('Review submitted successfully') });
      router.push(`/decisions/${decisionSlug}`);
    },
    onError: (error) => {
      toast.error({
        message: error.message || t('Failed to submit review'),
      });
    },
  });

  const scheduleAutosave = useAutosaveDraft({
    assignmentId,
    answers: values,
    rationales,
    overallComment,
    enabled: !isSubmitted && !isPausedForRevision,
  });

  const requestRevisionMutation = trpc.decision.requestRevision.useMutation({
    onSuccess: () => {
      toast.success({ message: t('Revision requested') });
    },
    onError: (error) => {
      toast.error({
        message: error.message || t('Failed to request revision'),
      });
    },
  });

  const cancelRevisionMutation =
    trpc.decision.cancelRevisionRequest.useMutation({
      onSuccess: () => {
        toast.success({ message: t('Revision request cancelled') });
      },
      onError: (error) => {
        toast.error({
          message: error.message || t('Failed to cancel revision request'),
        });
      },
    });

  const canSubmit = useMemo(
    () => schemaValidator.validate(rubricTemplate, values).valid,
    [rubricTemplate, values],
  );

  const handleValueChange = useCallback(
    (key: string, value: unknown) => {
      setValues((current) => ({ ...current, [key]: value }));
      scheduleAutosave();
    },
    [scheduleAutosave],
  );

  const handleRationaleChange = useCallback(
    (key: string, value: string) => {
      setRationales((current) => ({ ...current, [key]: value }));
      scheduleAutosave();
    },
    [scheduleAutosave],
  );

  const handleOverallCommentChange = useCallback(
    (value: string) => {
      setOverallComment(value);
      scheduleAutosave();
    },
    [scheduleAutosave],
  );

  const handleSubmit = useCallback(() => {
    submitReview.mutate({
      assignmentId,
      reviewData: { answers: values, rationales },
      overallComment: overallComment.trim() ? overallComment : null,
    });
  }, [assignmentId, values, rationales, overallComment, submitReview]);

  const handleRequestRevision = useCallback(
    (comment: string) => {
      requestRevisionMutation.mutate({
        assignmentId,
        requestComment: comment,
      });
    },
    [assignmentId, requestRevisionMutation],
  );

  const handleCancelRevision = useCallback(() => {
    if (!ownRevisionRequest) {
      return;
    }
    cancelRevisionMutation.mutate({
      assignmentId,
      revisionRequestId: ownRevisionRequest.id,
    });
  }, [assignmentId, ownRevisionRequest, cancelRevisionMutation]);

  const state = useMemo<ReviewFormState>(
    () => ({
      values,
      rationales,
      overallComment,
      canSubmit: canSubmit && !isSubmitted && !isPausedForRevision,
      isSubmitting: submitReview.isPending,
      isSubmitted,
      isPausedForRevision,
      revisionRequest: effectiveRevisionRequest,
      isOwnRevisionRequest,
      canRequestRevision,
      rubricTemplate,
      review,
      assignment,
      handleValueChange,
      handleRationaleChange,
      handleOverallCommentChange,
      handleSubmit,
      requestRevision: handleRequestRevision,
      cancelRevisionRequest: handleCancelRevision,
      isRequestingRevision: requestRevisionMutation.isPending,
      isCancellingRevision: cancelRevisionMutation.isPending,
    }),
    [
      values,
      rationales,
      overallComment,
      canSubmit,
      isSubmitted,
      isPausedForRevision,
      effectiveRevisionRequest,
      isOwnRevisionRequest,
      canRequestRevision,
      rubricTemplate,
      review,
      assignment,
      submitReview.isPending,
      requestRevisionMutation.isPending,
      cancelRevisionMutation.isPending,
      handleValueChange,
      handleRationaleChange,
      handleOverallCommentChange,
      handleSubmit,
      handleRequestRevision,
      handleCancelRevision,
    ],
  );

  return (
    <ReviewFormContext.Provider value={state}>
      {children}
    </ReviewFormContext.Provider>
  );
}

function useAutosaveDraft({
  assignmentId,
  answers,
  rationales,
  overallComment,
  enabled,
}: {
  assignmentId: string;
  answers: Record<string, unknown>;
  rationales: Record<string, string>;
  overallComment: string;
  enabled: boolean;
}) {
  const saveReviewDraft = trpc.decision.saveReviewDraft.useMutation();

  const inflightRef = useRef<Promise<void> | null>(null);
  // Set when an edit lands during an in-flight save; the save's .then
  // re-arms the debounce so the latest payload reaches the server.
  const rerunRef = useRef(false);

  // Closure captures the latest answers/rationales on each render.
  // useDebouncedCallback stores the callback in its own ref, so the
  // debounce instance stays stable while always calling the latest `save`.
  const save = () => {
    if (!enabled) {
      return;
    }
    if (inflightRef.current) {
      rerunRef.current = true;
      return;
    }
    rerunRef.current = false;
    inflightRef.current = saveReviewDraft
      .mutateAsync({
        assignmentId,
        reviewData: { answers, rationales },
        overallComment: overallComment.trim() ? overallComment : null,
      })
      .catch(() => {})
      .then(() => {
        inflightRef.current = null;
        if (rerunRef.current) {
          debouncedSave();
        }
      });
  };

  const debouncedSave = useDebouncedCallback(save, AUTOSAVE_DEBOUNCE_MS);

  // Flush (not cancel) on unmount so edits in the final debounce window
  // are persisted when the reviewer navigates away.
  useEffect(
    () => () => {
      debouncedSave.flush();
    },
    [debouncedSave],
  );

  return debouncedSave;
}
