import {
  type Geocode,
  NotFoundError,
  SMS_BROWSE_END_MESSAGE,
  SMS_BROWSE_LAST_FOOTER,
  SMS_BROWSE_MORE_FOOTER,
  SMS_BALLOT_UNAVAILABLE_MESSAGE,
  SMS_BROWSE_START_MESSAGE,
  SMS_INFO_NEEDS_CODE_MESSAGE,
  SMS_INFO_NEEDS_DECISION_MESSAGE,
  SMS_PROPOSALS_NEEDS_DECISION_MESSAGE,
  SMS_VOTE_NEEDS_DECISION_MESSAGE,
  type SmsBallotPage,
  UnauthorizedError,
  ValidationError,
  VoterNotEnrolledError,
  affirmVoterAttestation,
  clipSmsText,
  describeEnrolmentDecision,
  findBallotDraft,
  findLatestBallotDraft,
  findPendingVoterEnrolment,
  findVoterEnrolment,
  isVoterEnrolled,
  pendingEnrolmentStep,
  formatSmsAddressNotFound,
  formatSmsAddressOutside,
  formatSmsAddressResolved,
  formatSmsBallotPageHeading,
  formatSmsBallotScope,
  formatSmsDecisionInfo,
  formatSmsDecisionList,
  formatSmsEnrolled,
  formatSmsEnrolmentWelcome,
  formatSmsNoEnrolmentNeeded,
  formatSmsNothingToAffirm,
  formatSmsProposalInfo,
  formatSmsProposalNotOnBallot,
  formatSmsProposalPage,
  formatSmsRegisterFirst,
  formatSmsVotingClosed,
  getSmsBallotProposal,
  getSmsDecisionDescription,
  getSmsVotingDecision,
  listSmsBallotPage,
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
  id: string;
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

const PROPOSAL_CODE_PATTERN = /^\d{3,10}$/;

const sendBallotPage = (
  deliver: SmsDeliver,
  page: SmsBallotPage,
  kind: 'first' | 'next',
): Promise<SmsCommandResult> => {
  if (page.items.length === 0) {
    return kind === 'first'
      ? deliverAll(
          deliver,
          'send-ballot-page',
          'Ballot page',
          formatSmsProposalPage({ items: [], hasMore: false }),
          'ballot empty',
        )
      : deliverAll(
          deliver,
          'send-browse-ended',
          'Browse ended reply',
          [SMS_BROWSE_END_MESSAGE],
          'browse ended',
        );
  }

  const hasMore = page.nextCursor !== null;

  return deliverAll(
    deliver,
    'send-ballot-page',
    'Ballot page',
    formatSmsProposalPage({
      items: page.items,
      hasMore,
      heading: formatSmsBallotPageHeading({
        scope: formatSmsBallotScope(page),
        total: page.total,
        count: page.items.length,
        continued: kind === 'next',
      }),
      footer: hasMore ? SMS_BROWSE_MORE_FOOTER : SMS_BROWSE_LAST_FOOTER,
    }),
    kind === 'first' ? 'ballot page sent' : 'next ballot page sent',
  );
};

export const proposals: SmsCommandHandler = async (context) => {
  const { step, account, deliver } = context;
  const slug = context.argument ?? context.line?.slug;

  if (!slug) {
    return deliverAll(
      deliver,
      'send-proposals-needs-decision',
      'Proposals needs a decision',
      [SMS_PROPOSALS_NEEDS_DECISION_MESSAGE],
      'proposals needs a decision',
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

  if (decision.enrolment) {
    const enrolment = await step.run('find-enrolment', () =>
      findVoterEnrolment({
        processInstanceId: decision.instanceId,
        authUserId: account.authUserId,
      }),
    );

    if (
      !isEnrolledOnCurrentAttestation(enrolment, decision.enrolment.attestation)
    ) {
      return deliverAll(
        deliver,
        'send-register-first',
        'Register first reply',
        [formatSmsRegisterFirst(decision.name, context.argument)],
        'register first',
      );
    }
  }

  const page = await step.run('list-ballot-page', () =>
    readBallot(() =>
      listSmsBallotPage({
        authUserId: account.authUserId,
        instanceId: decision.instanceId,
        chatLineId: context.line?.id ?? null,
      }),
    ),
  );

  return page.ok
    ? sendBallotPage(deliver, page.value, 'first')
    : refuseBallotRead(context, page.reason, decision.instanceId);
};

type BallotRead<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'unavailable' | 'not_enrolled' | 'closed' };

const readBallot = async <T>(fn: () => Promise<T>): Promise<BallotRead<T>> => {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    if (error instanceof VoterNotEnrolledError) {
      return { ok: false, reason: 'not_enrolled' };
    }
    if (error instanceof NotFoundError || error instanceof UnauthorizedError) {
      return { ok: false, reason: 'unavailable' };
    }
    if (error instanceof ValidationError) {
      return { ok: false, reason: 'closed' };
    }
    throw error;
  }
};

const refuseBallotRead = async (
  { step, deliver }: SmsCommandContext,
  reason: 'unavailable' | 'not_enrolled' | 'closed',
  instanceId: string,
): Promise<SmsCommandResult> => {
  if (reason === 'unavailable') {
    return deliverAll(
      deliver,
      'send-ballot-unavailable',
      'Ballot unavailable reply',
      [SMS_BALLOT_UNAVAILABLE_MESSAGE],
      'decision not found',
    );
  }
  const decision = await step.run('describe-ballot-decision', () =>
    describeEnrolmentDecision({ instanceId }),
  );
  return reason === 'closed'
    ? deliverAll(
        deliver,
        'send-voting-closed',
        'Voting closed reply',
        formatSmsVotingClosed(decision.name),
        'voting closed',
      )
    : deliverAll(
        deliver,
        'send-register-first',
        'Register first reply',
        [formatSmsRegisterFirst(decision.name)],
        'register first',
      );
};

// On a decision line the line's own decision is the default; a decision the
// voter browsed by slug on that same line overrides it, and a draft browsed
// on another line never does. On the shared number the latest draft wins.
const resolveBrowseInstance = async ({
  step,
  account,
  line,
}: SmsCommandContext): Promise<string | null> => {
  const draft = await step.run('find-latest-draft', () =>
    findLatestBallotDraft({
      authUserId: account.authUserId,
      ...(line ? { chatLineId: line.id } : {}),
    }),
  );
  return draft?.processInstanceId ?? line?.instanceId ?? null;
};

export const more: SmsCommandHandler = async (context) => {
  const { step, account, deliver } = context;
  const instanceId = await resolveBrowseInstance(context);
  const draft = instanceId
    ? await step.run('find-ballot-draft', () =>
        findBallotDraft({
          processInstanceId: instanceId,
          authUserId: account.authUserId,
        }),
      )
    : null;

  if (!draft || draft.pageCursor === null) {
    return deliverAll(
      deliver,
      'send-browse-start',
      'Browse start reply',
      [SMS_BROWSE_START_MESSAGE],
      'browse not started',
    );
  }

  const after = draft.pageCursor;
  const page = await step.run('list-ballot-page', () =>
    readBallot(() =>
      listSmsBallotPage({
        authUserId: account.authUserId,
        instanceId: draft.processInstanceId,
        after,
      }),
    ),
  );

  return page.ok
    ? sendBallotPage(deliver, page.value, 'next')
    : refuseBallotRead(context, page.reason, draft.processInstanceId);
};

export const info: SmsCommandHandler = async (context) => {
  const { step, account, deliver } = context;
  const code =
    context.argument && PROPOSAL_CODE_PATTERN.test(context.argument)
      ? Number(context.argument)
      : null;

  if (code === null) {
    return deliverAll(
      deliver,
      'send-info-needs-code',
      'Info needs a code',
      [SMS_INFO_NEEDS_CODE_MESSAGE],
      'info needs a code',
    );
  }

  const instanceId = await resolveBrowseInstance(context);

  if (!instanceId) {
    return deliverAll(
      deliver,
      'send-info-needs-decision',
      'Info needs a decision',
      [SMS_INFO_NEEDS_DECISION_MESSAGE],
      'info needs a decision',
    );
  }

  const read = await step.run('get-ballot-proposal', () =>
    readBallot(() =>
      getSmsBallotProposal({
        authUserId: account.authUserId,
        instanceId,
        code,
      }),
    ),
  );

  if (!read.ok) {
    return refuseBallotRead(context, read.reason, instanceId);
  }

  const proposal = read.value;

  if (!proposal) {
    return deliverAll(
      deliver,
      'send-proposal-not-on-ballot',
      'Proposal not on ballot reply',
      [formatSmsProposalNotOnBallot(code)],
      'proposal not on ballot',
    );
  }

  return deliverAll(
    deliver,
    'send-proposal-info',
    'Proposal info',
    formatSmsProposalInfo(proposal),
    'proposal info sent',
  );
};
