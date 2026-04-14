'use client';

import { trpc } from '@op/api/client';
import {
  type ProposalReview,
  type ProposalReviewRequest,
  type RubricTemplateSchema,
  schemaValidator,
} from '@op/common/client';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { useTranslations } from '@/lib/i18n';

interface ReviewFormState {
  values: Record<string, unknown>;
  canSubmit: boolean;
  isSubmitting: boolean;
  isSubmitted: boolean;
  isPausedForRevision: boolean;
  revisionRequest: ProposalReviewRequest | null;
  handleValueChange: (key: string, value: unknown) => void;
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
  initialRevisionRequest,
  assignmentId,
  decisionSlug,
  children,
}: {
  template: RubricTemplateSchema;
  review: ProposalReview | null;
  initialRevisionRequest: ProposalReviewRequest | null;
  assignmentId: string;
  decisionSlug: string;
  children: ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [values, setValues] = useState<Record<string, unknown>>(
    review?.reviewData ?? {},
  );
  const [revisionRequest, setRevisionRequest] =
    useState<ProposalReviewRequest | null>(initialRevisionRequest);

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

  const requestRevisionMutation = trpc.decision.requestRevision.useMutation({
    onSuccess: (data) => {
      setRevisionRequest(data);
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
      onSuccess: (data) => {
        setRevisionRequest(data);
        toast.success({ message: t('Revision request cancelled') });
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

  const handleValueChange = useCallback((key: string, value: unknown) => {
    setValues((current) => ({ ...current, [key]: value }));
  }, []);

  const handleSubmit = useCallback(() => {
    // TODO: include overallComment (feedback to author) in submission
    submitReview.mutate({
      assignmentId,
      reviewData: values,
    });
  }, [assignmentId, values, submitReview]);

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
      canSubmit: canSubmit && !isSubmitted && !isPausedForRevision,
      isSubmitting: submitReview.isPending,
      isSubmitted,
      isPausedForRevision: !!isPausedForRevision,
      revisionRequest,
      handleValueChange,
      handleSubmit,
      requestRevision: handleRequestRevision,
      cancelRevisionRequest: handleCancelRevision,
      isRequestingRevision: requestRevisionMutation.isPending,
      isCancellingRevision: cancelRevisionMutation.isPending,
    }),
    [
      values,
      canSubmit,
      isSubmitted,
      isPausedForRevision,
      revisionRequest,
      submitReview.isPending,
      requestRevisionMutation.isPending,
      cancelRevisionMutation.isPending,
      handleValueChange,
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
