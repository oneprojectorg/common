import { toast } from '@op/ui/Toast';

import type { TranslateFn } from '@/lib/i18n';

/**
 * Handles tRPC validation errors from mutation responses.
 * Displays appropriate toast messages based on error shape.
 *
 * When `onFieldErrors` is provided, it owns the full validation-error UX
 * (field highlighting + toast) and this function just extracts the errors
 * and delegates. The toasts below are the no-handler fallback.
 */
export function handleMutationError(
  error: { data?: unknown; message?: string },
  operationType: 'create' | 'update' | 'submit',
  t: TranslateFn,
  options?: {
    onFieldErrors?: (fieldErrors: Record<string, string>) => void;
  },
) {
  console.error(`Failed to ${operationType} proposal:`, error);

  const errorData = error.data as
    | { cause?: { fieldErrors?: Record<string, string> } }
    | undefined;

  if (errorData?.cause?.fieldErrors) {
    const fieldErrors = errorData.cause.fieldErrors;

    if (options?.onFieldErrors) {
      options.onFieldErrors(fieldErrors);
      return;
    }

    const errorMessages = Object.values(fieldErrors);
    if (errorMessages.length === 1) {
      toast.error({ message: errorMessages[0] });
    } else {
      toast.error({
        title: t('Please fix the following issues:'),
        message: errorMessages.join(', '),
      });
    }
  } else {
    const titleMap = {
      create: t('Failed to create proposal'),
      update: t('Failed to update proposal'),
      submit: t('Failed to submit proposal'),
    } as const;
    toast.error({
      title: titleMap[operationType],
      message: error.message || t('An unexpected error occurred'),
    });
  }
}
