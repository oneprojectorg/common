'use client';

import { trpc } from '@op/api/client';
import {
  type ProposalReview,
  type ProposalReviewRequest,
  type RubricTemplateSchema,
  schemaValidator,
} from '@op/common/client';
import { useDebouncedCallback } from '@op/hooks';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';
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

import { useTranslations } from '@/lib/i18n';

const AUTOSAVE_DEBOUNCE_MS = 1000;

interface ReviewFormState {
  /** Rubric answers keyed by criterion id; validated against the template. */
  values: Record<string, unknown>;
  /** Optional free-text rationale per criterion id (always optional). */
  rationales: Record<string, string>;
  canSubmit: boolean;
  isSubmitting: boolean;
  isSubmitted: boolean;
  isPausedForRevision: boolean;
  revisionRequest: ProposalReviewRequest | null;
  handleValueChange: (key: string, value: unknown) => void;
  handleRationaleChange: (key: string, value: string) => void;
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

export function ReviewFormProvider({
  template,
  review,
  revisionRequest,
  assignmentId,
  decisionSlug,
  children,
}: {
  template: RubricTemplateSchema;
  review: ProposalReview | null;
  revisionRequest: ProposalReviewRequest | null;
  assignmentId: string;
  decisionSlug: string;
  children: ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [values, setValues] = useState<Record<string, unknown>>(
    review?.reviewData.answers ?? {},
  );
  const [rationales, setRationales] = useState<Record<string, string>>(
    review?.reviewData.rationales ?? {},
  );
  const isSubmitted = review?.state === 'submitted';
  const isPausedForRevision = revisionRequest?.state === 'requested';

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
    enabled: !isSubmitted && !isPausedForRevision,
  });

  const requestRevisionMutation = trpc.decision.requestRevision.useMutation({
    onSuccess: () => {
      toast.success({ message: t('Revision requested') });
      // TODO: To be replaced with query invalidation for server-side fetched data
      router.refresh();
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
        // TODO: To be replaced with query invalidation for server-side fetched data
        router.refresh();
      },
      onError: (error) => {
        toast.error({
          message: error.message || t('Failed to cancel revision request'),
        });
      },
    });

  const canSubmit = useMemo(
    () => schemaValidator.validate(template, values).valid,
    [template, values],
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

  const handleSubmit = useCallback(() => {
    // A trailing autosave landing after submit is filtered out at the DB
    // level by saveReviewDraft's setWhere guard, so no client-side flush.
    submitReview.mutate({
      assignmentId,
      reviewData: { answers: values, rationales },
    });
  }, [assignmentId, values, rationales, submitReview]);

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
    if (!revisionRequest) {
      return;
    }
    cancelRevisionMutation.mutate({
      assignmentId,
      revisionRequestId: revisionRequest.id,
    });
  }, [assignmentId, revisionRequest, cancelRevisionMutation]);

  const state = useMemo<ReviewFormState>(
    () => ({
      values,
      rationales,
      canSubmit: canSubmit && !isSubmitted && !isPausedForRevision,
      isSubmitting: submitReview.isPending,
      isSubmitted,
      isPausedForRevision: !!isPausedForRevision,
      revisionRequest,
      handleValueChange,
      handleRationaleChange,
      handleSubmit,
      requestRevision: handleRequestRevision,
      cancelRevisionRequest: handleCancelRevision,
      isRequestingRevision: requestRevisionMutation.isPending,
      isCancellingRevision: cancelRevisionMutation.isPending,
    }),
    [
      values,
      rationales,
      canSubmit,
      isSubmitted,
      isPausedForRevision,
      revisionRequest,
      submitReview.isPending,
      requestRevisionMutation.isPending,
      cancelRevisionMutation.isPending,
      handleValueChange,
      handleRationaleChange,
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
  enabled,
}: {
  assignmentId: string;
  answers: Record<string, unknown>;
  rationales: Record<string, string>;
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
