import { toast } from '@op/ui/Toast';

/**
 * Handles tRPC validation errors from mutation responses.
 * Displays appropriate toast messages based on error shape.
 */
export function handleMutationError(
  error: { data?: unknown; message?: string },
  operationType: 'create' | 'update' | 'submit',
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  console.error(`Failed to ${operationType} proposal:`, error);

  const errorData = error.data as
    | { cause?: { fieldErrors?: Record<string, string> } }
    | undefined;

  if (errorData?.cause?.fieldErrors) {
    const fieldErrors = errorData.cause.fieldErrors;
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
