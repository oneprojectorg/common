import { type BatchEmailItem, OPBatchSend } from '@op/emails';
import { logger } from '@op/logging';

/**
 * Sends one batch of notification emails and reports how many went out.
 *
 * Throwing on a partial failure is deliberate: Inngest retries the step, which
 * is the only recovery any of these notifications has. Callers wrap this in
 * `step.run` so the retry boundary stays with the workflow.
 */
export const sendNotificationEmails = async ({
  emails,
  failureMessage,
  context,
}: {
  emails: Array<BatchEmailItem>;
  /** What failed, for the log line — e.g. 'proposal merged notifications'. */
  failureMessage: string;
  /** Ids that identify this send in the logs. */
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
