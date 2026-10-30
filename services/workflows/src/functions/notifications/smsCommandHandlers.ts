import {
  type Geocode,
  NotFoundError,
  SMS_VOTE_NEEDS_DECISION_MESSAGE,
  UnauthorizedError,
  affirmVoterAttestation,
  clipSmsText,
  describeEnrolmentDecision,
  findPendingVoterEnrolment,
  findVoterEnrolment,
  isVoterEnrolled,
  pendingEnrolmentStep,
  formatSmsAddressNotFound,
  formatSmsAddressOutside,
  formatSmsAddressResolved,
  formatSmsDecisionInfo,
  formatSmsDecisionList,
  formatSmsEnrolled,
  formatSmsEnrolmentWelcome,
  formatSmsNoEnrolmentNeeded,
  formatSmsNothingToAffirm,
  formatSmsVotingClosed,
  getSmsDecisionDescription,
  getSmsVotingDecision,
  listSmsDecisions,
  resolveVoterAddress,
  startVoterEnrolment,
} from '@op/common';
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

export interface ChatLine {
  slug: string;
  instanceId: string;
}

export interface SmsCommandContext {
  step: GetStepTools<typeof inngest>;
  account: { authUserId: string };
  argument: string | null;
  body: string | null;
  line: ChatLine | null;
  deliver: SmsDeliver;
  geocode: Geocode;
}

export type SmsCommandHandler = (
  context: SmsCommandContext,
) => Promise<SmsCommandResult>;

const deliverAll = async (
  deliver: SmsDeliver,
  stepId: string,
  label: string,
  bodies: string[],
  message: string,
): Promise<SmsCommandResult> => {
  for (const [index, body] of bodies.entries()) {
    const failed = await deliver(
      index === 0 ? stepId : `${stepId}-${index + 1}`,
      label,
      body,
    );
    if (failed) {
      return failed;
    }
  }
  return { message };
};

const notFoundReply = (
  deliver: SmsDeliver,
  decisionSlug: string,
): Promise<SmsCommandResult> =>
  deliverAll(
    deliver,
    'send-not-found-reply',
    'Not-found reply',
    [
      `No decision named "${clipSmsText(decisionSlug, SMS_SLUG_LENGTH)}" was found.`,
    ],
    'decision not found',
  );

const swallowUnreadable = async <T>(
  lookup: () => Promise<T>,
): Promise<T | null> => {
  try {
    return await lookup();
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof UnauthorizedError) {
      return null;
    }
    throw error;
  }
};

export const join: SmsCommandHandler = async ({ deliver }) => {
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
  const result = await deliverAll(
    deliver,
    'send-decision-list',
    'Decision list',
    formatSmsDecisionList(decisions),
    'decisions sent',
  );
  return result.message === 'decisions sent'
    ? { ...result, count: decisions.length }
    : result;
};

const describeDecision = async (
  { step, account, deliver }: SmsCommandContext,
  decisionSlug: string,
): Promise<SmsCommandResult> => {
  const decision = await step.run('describe-decision', () =>
    swallowUnreadable(() =>
      getSmsDecisionDescription({
        authUserId: account.authUserId,
        decisionSlug,
      }),
    ),
  );

  if (!decision) {
    return notFoundReply(deliver, decisionSlug);
  }

  const failed = await deliver(
    'send-decision-reply',
    'Decision reply',
    formatSmsDecisionInfo(decision),
  );
  return failed ?? { message: 'decision sent' };
};

export const show: SmsCommandHandler = (context) => {
  const slug = context.argument ?? context.line?.slug;
  return slug ? describeDecision(context, slug) : listDecisions(context);
};

export const vote: SmsCommandHandler = async (context) => {
  const { step, account, deliver } = context;
  const slug = context.argument ?? context.line?.slug;

  if (!slug) {
    return deliverAll(
      deliver,
      'send-vote-needs-decision',
      'Vote needs a decision',
      [SMS_VOTE_NEEDS_DECISION_MESSAGE],
      'vote needs a decision',
    );
  }

  const decision = await step.run('resolve-voting-decision', () =>
    swallowUnreadable(() =>
      getSmsVotingDecision({
        authUserId: account.authUserId,
        decisionSlug: slug,
      }),
    ),
  );

  if (!decision) {
    return notFoundReply(deliver, slug);
  }

  if (!decision.votingOpen) {
    return deliverAll(
      deliver,
      'send-voting-closed',
      'Voting closed reply',
      formatSmsVotingClosed(decision.name),
      'voting closed',
    );
  }

  const rule = decision.enrolment;

  if (!rule) {
    return deliverAll(
      deliver,
      'send-no-enrolment-needed',
      'No enrolment needed reply',
      formatSmsNoEnrolmentNeeded(decision.name),
      'no enrolment needed',
    );
  }

  const key = {
    processInstanceId: decision.instanceId,
    authUserId: account.authUserId,
  };
  const pending = await step.run('find-pending-enrolment', () =>
    findPendingVoterEnrolment(key),
  );

  const resendAttestation = (district: string | null, message: string) =>
    deliverAll(
      deliver,
      'send-attestation-again',
      'Attestation reply',
      formatSmsAddressResolved({ district, attestation: rule.attestation }),
      message,
    );

  if (pending) {
    const waitingOn = await step.run('derive-enrolment-step', () =>
      pendingEnrolmentStep({
        processInstanceId: decision.instanceId,
        taxonomyTermId: pending.taxonomyTermId,
        rule,
      }),
    );
    if (waitingOn === 'awaiting_agree') {
      return resendAttestation(pending.districtName, 'attestation resent');
    }
    return deliverAll(
      deliver,
      'send-enrolment-welcome',
      'Registration welcome',
      formatSmsEnrolmentWelcome(decision.name),
      'enrolment started',
    );
  }

  const existing = await step.run('find-enrolment', () =>
    findVoterEnrolment(key),
  );

  if (isVoterEnrolled(existing)) {
    return deliverAll(
      deliver,
      'send-already-enrolled',
      'Already registered reply',
      formatSmsEnrolled({
        decisionName: decision.name,
        district: null,
        budget: decision.budget,
      }),
      'already enrolled',
    );
  }

  const started = await step.run('start-enrolment', () =>
    startVoterEnrolment(key),
  );
  const waitingOn = await step.run('derive-enrolment-step', () =>
    pendingEnrolmentStep({
      processInstanceId: decision.instanceId,
      taxonomyTermId: started.taxonomyTermId,
      rule,
    }),
  );

  if (waitingOn === 'awaiting_agree') {
    return resendAttestation(null, 'attestation sent');
  }

  return deliverAll(
    deliver,
    'send-enrolment-welcome',
    'Registration welcome',
    formatSmsEnrolmentWelcome(decision.name),
    'enrolment started',
  );
};

export const agree: SmsCommandHandler = async (context) => {
  const { step, account, deliver } = context;
  const nothingToAffirm = () =>
    deliverAll(
      deliver,
      'send-nothing-to-affirm',
      'Nothing to affirm reply',
      formatSmsNothingToAffirm(),
      'nothing to affirm',
    );

  const pending = await step.run('find-pending-enrolment', () =>
    findPendingVoterEnrolment({ authUserId: account.authUserId }),
  );

  if (!pending) {
    return nothingToAffirm();
  }

  const decision = await step.run('describe-enrolment-decision', () =>
    describeEnrolmentDecision({ instanceId: pending.processInstanceId }),
  );
  const rule = decision.enrolment;

  if (!rule) {
    return nothingToAffirm();
  }

  const waitingOn = await step.run('derive-enrolment-step', () =>
    pendingEnrolmentStep({
      processInstanceId: pending.processInstanceId,
      taxonomyTermId: pending.taxonomyTermId,
      rule,
    }),
  );

  if (waitingOn !== 'awaiting_agree') {
    return nothingToAffirm();
  }

  await step.run('affirm-attestation', () =>
    affirmVoterAttestation({
      processInstanceId: pending.processInstanceId,
      authUserId: account.authUserId,
    }),
  );

  return deliverAll(
    deliver,
    'send-enrolled',
    'Registered reply',
    formatSmsEnrolled({
      decisionName: decision.name,
      district: pending.districtName,
      budget: decision.budget,
    }),
    'enrolled',
  );
};

export const freeText: SmsCommandHandler = async (context) => {
  const { step, account, deliver, geocode } = context;
  const address = context.body?.trim();

  if (!address) {
    return sendSmsHelp(deliver);
  }

  const pending = await step.run('find-pending-enrolment', () =>
    findPendingVoterEnrolment({ authUserId: account.authUserId }),
  );

  if (!pending) {
    return sendSmsHelp(deliver);
  }

  const decision = await step.run('describe-enrolment-decision', () =>
    describeEnrolmentDecision({ instanceId: pending.processInstanceId }),
  );
  const rule = decision.enrolment;

  if (!rule) {
    return sendSmsHelp(deliver);
  }

  const waitingOn = await step.run('derive-enrolment-step', () =>
    pendingEnrolmentStep({
      processInstanceId: pending.processInstanceId,
      taxonomyTermId: pending.taxonomyTermId,
      rule,
    }),
  );

  if (waitingOn !== 'awaiting_address') {
    return sendSmsHelp(deliver);
  }

  const resolution = await step.run('resolve-address', () =>
    resolveVoterAddress({
      processInstanceId: pending.processInstanceId,
      authUserId: account.authUserId,
      address,
      geocode,
    }),
  );

  switch (resolution.status) {
    case 'not_found':
      return deliverAll(
        deliver,
        'send-address-not-found',
        'Address not found reply',
        formatSmsAddressNotFound(),
        'address not found',
      );
    case 'outside':
      return deliverAll(
        deliver,
        'send-address-outside',
        'Address outside reply',
        formatSmsAddressOutside(decision.name),
        'address outside',
      );
    case 'resolved':
      return deliverAll(
        deliver,
        'send-attestation',
        'Attestation reply',
        formatSmsAddressResolved({
          district: resolution.boundary?.name ?? null,
          attestation: rule.attestation,
        }),
        'address resolved',
      );
  }
};

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
