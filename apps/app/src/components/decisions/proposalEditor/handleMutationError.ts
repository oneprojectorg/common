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

  const errorData = error.data as
    | { cause?: { fieldErrors?: Record<string, string> } }
    | undefined;

  if (errorData?.cause?.fieldErrors) {
    const fieldErrors = errorData.cause.fieldErrors;
    const errorMessages = Object.values(fieldErrors);

    if (errorMessages.length === 1) {
      toast.error(errorMessages[0]);
    } else {
      toast.error(t('decisions.proposals.validationIssuesHeading'), {
        description: errorMessages.join(', '),
      });
    }
  } else {
    const titleMap = {
      create: t('decisions.proposals.createProposalError'),
      update: t('decisions.proposals.updateProposalError'),
      submit: t('decisions.proposals.submitProposalError'),
    } as const;
    toast.error(titleMap[operationType], {
      description: error.message || t('decisions.proposals.unexpectedError'),
    });
  }
}
