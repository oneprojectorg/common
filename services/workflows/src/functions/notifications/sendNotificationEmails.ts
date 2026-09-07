import { type BatchEmailItem, OPBatchSend } from '@op/emails';
import { logger } from '@op/logging';

/**
 * Throwing on a partial failure is deliberate — the Inngest retry is the only
 * recovery these notifications have. Callers wrap this in `step.run`.
 */
export const sendNotificationEmails = async ({
  emails,
  failureMessage,
  context,
  idempotencyKeyPrefix,
}: {
  emails: Array<BatchEmailItem>;
  /** Noun phrase for the log line, e.g. 'proposal merged notifications'. */
  failureMessage: string;
  context: Record<string, string>;
  /**
   * Scope to the Inngest run id on a fan-out send. Without it the throw above
   * makes the retry re-deliver every chunk that already succeeded — tolerable
   * for a proposal's two co-authors, not for a whole phase of them.
   */
  idempotencyKeyPrefix?: string;
}): Promise<{ sent: number }> => {
  try {
    const { data, errors } = await OPBatchSend(emails, {
      idempotencyKeyPrefix,
    });

    if (errors.length > 0) {
      throw new Error(`Email batch failed: ${JSON.stringify(errors)}`);
    }

    return { sent: data.length };
  } catch (error) {
    logger.error(`Failed to send ${failureMessage}`, { error, ...context });

    throw error;
  }
};
