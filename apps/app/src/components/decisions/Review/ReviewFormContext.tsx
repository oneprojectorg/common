'use client';

import { trpc } from '@op/api/client';
import {
  type ProposalReview,
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
  feedbackToAuthor: string;
  canSubmit: boolean;
  isSubmitting: boolean;
  isSubmitted: boolean;
  handleValueChange: (key: string, value: unknown) => void;
  setFeedbackToAuthor: (value: string) => void;
  handleSubmit: () => void;
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
  assignmentId,
  decisionSlug,
  children,
}: {
  template: RubricTemplateSchema;
  review: ProposalReview | null;
  assignmentId: string;
  decisionSlug: string;
  children: ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [values, setValues] = useState<Record<string, unknown>>(
    review?.reviewData ?? {},
  );
  const [feedbackToAuthor, setFeedbackToAuthor] = useState(
    review?.overallComment ?? '',
  );

  const isSubmitted = review?.state === 'submitted';

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

  const canSubmit = useMemo(
    () => schemaValidator.validate(template, values).valid,
    [template, values],
  );

  const handleValueChange = useCallback((key: string, value: unknown) => {
    setValues((current) => ({ ...current, [key]: value }));
  }, []);

  const handleSubmit = useCallback(() => {
    submitReview.mutate({
      assignmentId,
      reviewData: values,
      overallComment: feedbackToAuthor || null,
    });
  }, [assignmentId, values, feedbackToAuthor, submitReview]);

  const state = useMemo<ReviewFormState>(
    () => ({
      values,
      feedbackToAuthor,
      canSubmit: canSubmit && !isSubmitted,
      isSubmitting: submitReview.isPending,
      isSubmitted,
      handleValueChange,
      setFeedbackToAuthor,
      handleSubmit,
    }),
    [
      values,
      feedbackToAuthor,
      canSubmit,
      isSubmitted,
      submitReview.isPending,
      handleValueChange,
      handleSubmit,
    ],
  );

  return (
    <ReviewFormContext.Provider value={state}>
      {children}
    </ReviewFormContext.Provider>
  );
}
