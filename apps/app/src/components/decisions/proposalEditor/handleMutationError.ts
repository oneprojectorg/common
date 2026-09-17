import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';

import type { TranslateFn } from '@/lib/i18n';

/**
 * Handles tRPC validation errors from mutation responses.
 * Displays appropriate toast messages based on error shape.
 */
export function handleMutationError(
  error: { data?: unknown; message?: string },
  operationType: 'create' | 'update' | 'submit',
  t: TranslateFn,
) {
  logger.error(`Failed to ${operationType} proposal`, {
    error,
    context: `handleMutationError.${operationType}`,
  });

  // The API's error formatter copies ValidationError.fieldErrors onto the
  // error's `data` (services/api/src/lib/error.ts).
  const errorData = error.data as
    | { fieldErrors?: Record<string, string> }
    | undefined;

  if (errorData?.fieldErrors) {
    const fieldErrors = errorData.fieldErrors;
    const errorMessages = Object.values(fieldErrors);

    if (errorMessages.length === 1) {
      toast.error(errorMessages[0]);
    } else {
      toast.error(t('Please fix the following issues:'), {
        description: errorMessages.join(', '),
      });
    }
  } else {
    const titleMap = {
      create: t('Failed to create proposal'),
      update: t('Failed to update proposal'),
      submit: t('Failed to submit proposal'),
    } as const;
    toast.error(titleMap[operationType], {
      description: error.message || t('An unexpected error occurred'),
    });
  }
}
