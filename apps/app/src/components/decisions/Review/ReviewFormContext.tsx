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

  const saveReviewDraft = trpc.decision.saveReviewDraft.useMutation();

  // Ref keeps the debounced callback stable while always reading the freshest
  // form state — avoids rebuilding the debounce on every keystroke.
  const autosavePayloadRef = useRef({
    values,
    rationales,
  });
  autosavePayloadRef.current = { values, rationales };

  const inflightAutosaveRef = useRef<Promise<unknown> | null>(null);
  const hasPendingAutosaveRef = useRef(false);

  const triggerAutosave = useCallback(() => {
    const run = () => {
      if (isSubmitted || isPausedForRevision) {
        return;
      }
      // If a save is in flight, defer — the current save's .finally re-fires
      // run() so edits made mid-save are persisted with the latest payload.
      if (inflightAutosaveRef.current) {
        hasPendingAutosaveRef.current = true;
        return;
      }
      const { values: latestValues, rationales: latestRationales } =
        autosavePayloadRef.current;
      hasPendingAutosaveRef.current = false;
      const promise = saveReviewDraft.mutateAsync({
        assignmentId,
        reviewData: { answers: latestValues, rationales: latestRationales },
      });
      inflightAutosaveRef.current = promise;
      promise
        .catch(() => {})
        .finally(() => {
          inflightAutosaveRef.current = null;
          if (hasPendingAutosaveRef.current) {
            run();
          }
        });
    };
    run();
  }, [assignmentId, isPausedForRevision, isSubmitted, saveReviewDraft]);

  const debouncedSaveDraft = useDebouncedCallback(
    triggerAutosave,
    AUTOSAVE_DEBOUNCE_MS,
  );

  const flushPendingChanges = useCallback(async (): Promise<boolean> => {
    debouncedSaveDraft.flush();
    while (inflightAutosaveRef.current) {
      try {
        await inflightAutosaveRef.current;
      } catch {
        return false;
      }
    }
    return true;
  }, [debouncedSaveDraft]);

  // Flush (not cancel) on unmount so edits made in the final debounce window
  // are persisted when the reviewer navigates away.
  useEffect(() => {
    return () => {
      debouncedSaveDraft.flush();
    };
  }, [debouncedSaveDraft]);

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
      debouncedSaveDraft();
    },
    [debouncedSaveDraft],
  );

  const handleRationaleChange = useCallback(
    (key: string, value: string) => {
      setRationales((current) => ({ ...current, [key]: value }));
      debouncedSaveDraft();
    },
    [debouncedSaveDraft],
  );

  const handleSubmit = useCallback(async () => {
    // Await pending/in-flight drafts so a trailing autosave can't overwrite
    // the submitted payload on the same client.
    await flushPendingChanges();
    // TODO: include overallComment (feedback to author) in submission
    submitReview.mutate({
      assignmentId,
      reviewData: { answers: values, rationales },
    });
  }, [assignmentId, values, rationales, submitReview, flushPendingChanges]);

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
