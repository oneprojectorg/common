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
}: {
  emails: Array<BatchEmailItem>;
  /** Noun phrase for the log line, e.g. 'proposal merged notifications'. */
  failureMessage: string;
  context: Record<string, string>;
}): Promise<{ sent: number }> => {
  try {
    const { data, errors } = await OPBatchSend(emails);

    if (errors.length > 0) {
      throw new Error(`Email batch failed: ${JSON.stringify(errors)}`);
    }

    return { sent: data.length };
  } catch (error) {
    logger.error(`Failed to send ${failureMessage}`, { error, ...context });

    throw error;
  }
};
