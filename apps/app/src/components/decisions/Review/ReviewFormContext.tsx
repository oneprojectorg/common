'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import {
  type ProposalReview,
  type ProposalReviewAssignment,
  type ProposalReviewRequest,
  ProposalReviewRequestState,
  ProposalReviewState,
  type ReviewSettings,
  type RubricReviewData,
  type RubricTemplateSchema,
  schemaValidator,
} from '@op/common/client';
import { useDebouncedCallback } from '@op/hooks';
import { toast } from '@op/sense/Toast';
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

import { withYesNoDefaults } from '../rubricTemplate';

const AUTOSAVE_DEBOUNCE_MS = 1000;

interface ReviewFormState {
  /** Resolved review settings for the assignment's phase. */
  reviewSettings: ReviewSettings;
  /** Rubric answers keyed by criterion id; validated against the rubricTemplate. */
  values: RubricReviewData['answers'];
  /** Optional free-text rationale per criterion id (always optional). */
  rationales: RubricReviewData['rationales'];
  /** Optional free-text feedback shown to the author after the review phase. */
  overallComment: string;
  canSubmit: boolean;
  isSubmitting: boolean;
  isSubmitted: boolean;
  /** Reviewer may edit their submitted review (submitted + review phase still current). */
  canEditReview: boolean;
  /** Submitted review is currently switched back into the editable form. */
  isEditing: boolean;
  isUpdating: boolean;
  /** Update button is enabled — editing an already-submitted review with a valid rubric. */
  canUpdate: boolean;
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
  handleSubmit: () => Promise<void>;
  startEditing: () => void;
  handleUpdate: () => Promise<void>;
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

/** What a host rendering the form's primary action outside it needs. */
export interface ReviewFormStatus {
  /** Resolves once the write settles, whether it succeeded or not. */
  submit: () => Promise<void>;
  canSubmit: boolean;
}

export function ReviewFormProvider(props: {
  assignmentId: string;
  decisionSlug: string;
  reviewSettings: ReviewSettings;
  /** Runs after a submit or an update instead of leaving for the decision page. */
  onCompleted?: () => void;
  /** Lets a host render the primary action outside the form. */
  onStatusChange?: (status: ReviewFormStatus) => void;
  initiallyEditing?: boolean;
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
  reviewSettings,
  onCompleted,
  onStatusChange,
  initiallyEditing = false,
  children,
}: {
  assignmentId: string;
  decisionSlug: string;
  reviewSettings: ReviewSettings;
  onCompleted?: () => void;
  onStatusChange?: (status: ReviewFormStatus) => void;
  initiallyEditing?: boolean;
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

  const { rubricTemplate, review, revisionRequest, assignment, canEditReview } =
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

  // Seed 'no' for untouched yes/no criteria — the switch already shows "No"
  // before it is touched, so a required criterion must not need a Yes→No
  // double-tap just to record that.
  const [values, setValues] = useState<RubricReviewData['answers']>(() =>
    withYesNoDefaults(rubricTemplate, review?.reviewData.answers ?? {}),
  );
  const [rationales, setRationales] = useState<RubricReviewData['rationales']>(
    review?.reviewData.rationales ?? {},
  );
  const [overallComment, setOverallComment] = useState<string>(
    review?.overallComment ?? '',
  );
  const isSubmitted = review?.state === ProposalReviewState.SUBMITTED;
  const isPausedForRevision = hasAnyOpenRevisionRequest;
  const canRequestRevision =
    reviewSettings.allowRevisions && !isSubmitted && !hasAnyOpenRevisionRequest;

  // Local: unsaved until "Update review", so navigating away discards edits.
  const [isEditing, setIsEditing] = useState(initiallyEditing);

  const submitReview = trpc.decision.submitReview.useMutation({
    onSuccess: () => {
      toast.success(t('Review submitted successfully'));
      if (onCompleted) {
        onCompleted();
        return;
      }
      router.push(`/decisions/${decisionSlug}/current`);
    },
    onError: (error) => {
      toast.error(error.message || t('Failed to submit review'));
    },
  });

  const updateReview = trpc.decision.updateReview.useMutation({
    onSuccess: () => {
      // The mutation's review channels invalidate getReviewAssignment locally,
      // refreshing the read-only view in place (as requestRevision does).
      setIsEditing(false);
      toast.success(t('Review updated successfully'));
      onCompleted?.();
    },
    onError: (error) => {
      toast.error(error.message || t('Failed to update review'));
    },
  });

  const scheduleAutosave = useAutosaveDraft({
    assignmentId,
    answers: values,
    rationales,
    overallComment,
    // Drafts are pre-submission only; edits to a submitted review persist
    // solely via "Update review", never autosave.
    enabled: !isSubmitted && !isPausedForRevision,
  });

  const requestRevisionMutation = trpc.decision.requestRevision.useMutation({
    onSuccess: () => {
      toast.success(t('Revision requested'));
    },
    onError: (error) => {
      toast.error(error.message || t('Failed to request revision'));
    },
  });

  const cancelRevisionMutation =
    trpc.decision.cancelRevisionRequest.useMutation({
      onSuccess: () => {
        toast.success(t('Revision request cancelled'));
      },
      onError: (error) => {
        toast.error(error.message || t('Failed to cancel revision request'));
      },
    });

  const isRubricValid = useMemo(
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

  // `.mutate` is stable; the mutation object is a new snapshot every render and
  // would give every handler, and the context value, a new identity each time.
  const submitMutate = submitReview.mutateAsync;
  const updateMutate = updateReview.mutateAsync;
  const requestRevisionMutate = requestRevisionMutation.mutate;
  const cancelRevisionMutate = cancelRevisionMutation.mutate;

  // Rejections are swallowed: the mutation's onError owns the message, and
  // callers only await settlement.
  const handleSubmit = useCallback(async () => {
    await submitMutate({
      assignmentId,
      reviewData: { answers: values, rationales },
      overallComment: overallComment.trim() ? overallComment : null,
    }).catch(() => {});
  }, [assignmentId, values, rationales, overallComment, submitMutate]);

  const startEditing = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleUpdate = useCallback(async () => {
    await updateMutate({
      assignmentId,
      reviewData: { answers: values, rationales },
      overallComment: overallComment.trim() ? overallComment : null,
    }).catch(() => {});
  }, [assignmentId, values, rationales, overallComment, updateMutate]);

  const handleRequestRevision = useCallback(
    (comment: string) => {
      requestRevisionMutate({
        assignmentId,
        requestComment: comment,
      });
    },
    [assignmentId, requestRevisionMutate],
  );

  const handleCancelRevision = useCallback(() => {
    if (!ownRevisionRequest) {
      return;
    }
    cancelRevisionMutate({
      assignmentId,
      revisionRequestId: ownRevisionRequest.id,
    });
  }, [assignmentId, ownRevisionRequest, cancelRevisionMutate]);

  const canSubmit = isRubricValid && !isSubmitted && !isPausedForRevision;
  const canUpdate = isRubricValid && isEditing;

  // What a host outside the form needs to drive its primary action.
  const primaryAction = isEditing ? handleUpdate : handleSubmit;
  const primaryActionEnabled = isEditing ? canUpdate : canSubmit;

  useEffect(() => {
    onStatusChange?.({
      submit: primaryAction,
      canSubmit: primaryActionEnabled,
    });
  }, [onStatusChange, primaryAction, primaryActionEnabled]);

  const state = useMemo<ReviewFormState>(
    () => ({
      reviewSettings,
      values,
      rationales,
      overallComment,
      canSubmit,
      isSubmitting: submitReview.isPending,
      isSubmitted,
      canEditReview,
      isEditing,
      isUpdating: updateReview.isPending,
      canUpdate,
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
      startEditing,
      handleUpdate,
      requestRevision: handleRequestRevision,
      cancelRevisionRequest: handleCancelRevision,
      isRequestingRevision: requestRevisionMutation.isPending,
      isCancellingRevision: cancelRevisionMutation.isPending,
    }),
    [
      reviewSettings,
      values,
      rationales,
      overallComment,
      canSubmit,
      canUpdate,
      isSubmitted,
      canEditReview,
      isEditing,
      updateReview.isPending,
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
      startEditing,
      handleUpdate,
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
  answers: RubricReviewData['answers'];
  rationales: RubricReviewData['rationales'];
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
