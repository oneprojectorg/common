import {
  NotFoundError,
  UnauthorizedError,
  clipSmsText,
  formatSmsDecisionInfo,
  formatSmsDecisionList,
  getSmsDecisionDescription,
  listSmsDecisions,
} from '@op/common';
import type { SmsKeyword } from '@op/core/sms';
import type { inngest } from '@op/events';
import type { GetStepTools } from 'inngest';

import {
  SMS_ALREADY_JOINED_MESSAGE,
  SMS_COMMAND_HELP_MESSAGE,
} from './smsReply';

const SMS_SLUG_LENGTH = 100;

export interface SmsReplyRejected {
  message: 'reply rejected';
  reason: string;
}

export interface SmsCommandResult {
  message: string;
  reason?: string;
  count?: number;
}

export type SmsDeliver = (
  stepId: string,
  label: string,
  body: string,
) => Promise<SmsReplyRejected | null>;

export interface SmsCommandContext {
  step: GetStepTools<typeof inngest>;
  account: { authUserId: string };
  argument: string | null;
  deliver: SmsDeliver;
}

export type SmsCommandHandler = (
  context: SmsCommandContext,
) => Promise<SmsCommandResult>;

const join: SmsCommandHandler = async ({ deliver }) => {
  const failed = await deliver(
    'send-already-joined-reply',
    'Already joined reply',
    SMS_ALREADY_JOINED_MESSAGE,
  );
  return failed ?? { message: 'already joined' };
};

const listDecisions: SmsCommandHandler = async ({ step, account, deliver }) => {
  const decisions = await step.run('list-decisions', () =>
    listSmsDecisions({ authUserId: account.authUserId }),
  );
  const bodies = formatSmsDecisionList(decisions);
  for (const [index, body] of bodies.entries()) {
    const failed = await deliver(
      index === 0 ? 'send-decision-list' : `send-decision-list-${index + 1}`,
      'Decision list',
      body,
    );
    if (failed) {
      return failed;
    }
  }
  return { message: 'decisions sent', count: decisions.length };
};

const describeDecision = async (
  { step, account, deliver }: SmsCommandContext,
  decisionSlug: string,
): Promise<SmsCommandResult> => {
  const decision = await step.run('describe-decision', async () => {
    try {
      return await getSmsDecisionDescription({
        authUserId: account.authUserId,
        decisionSlug,
      });
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof UnauthorizedError
      ) {
        return null;
      }
      throw error;
    }
  });

  if (!decision) {
    const failed = await deliver(
      'send-not-found-reply',
      'Not-found reply',
      `No decision named "${clipSmsText(decisionSlug, SMS_SLUG_LENGTH)}" was found.`,
    );
    return failed ?? { message: 'decision not found' };
  }

  const failed = await deliver(
    'send-decision-reply',
    'Decision reply',
    formatSmsDecisionInfo(decision),
  );
  return failed ?? { message: 'decision sent' };
};

const show: SmsCommandHandler = (context) =>
  context.argument
    ? describeDecision(context, context.argument)
    : listDecisions(context);

export const SMS_COMMAND_HANDLERS = { join, show } satisfies Record<
  SmsKeyword,
  SmsCommandHandler
>;

export const sendSmsHelp = async (
  deliver: SmsDeliver,
): Promise<SmsCommandResult> => {
  const failed = await deliver(
    'send-help-reply',
    'Help reply',
    SMS_COMMAND_HELP_MESSAGE,
  );
  return failed ?? { message: 'help sent' };
};
