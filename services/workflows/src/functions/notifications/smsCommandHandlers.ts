import {
  type Geocode,
  BallotCostError,
  NotFoundError,
  SMS_BALLOT_ALREADY_SUBMITTED_MESSAGE,
  SMS_BALLOT_CHANGE_FIRST_MESSAGE,
  SMS_BALLOT_CHANGE_NOT_ALLOWED_MESSAGE,
  SMS_BALLOT_OUTSIDE_SCOPE_MESSAGE,
  SMS_BALLOT_EMPTY_SUBMIT_MESSAGE,
  SMS_BALLOT_NEEDS_DECISION_MESSAGE,
  SMS_BALLOT_NOT_CAST_MESSAGE,
  SMS_BALLOT_REOPENED_MESSAGE,
  SMS_BALLOT_SUBMITTED_MESSAGE,
  SMS_BALLOT_UPDATED_MESSAGE,
  SMS_BROWSE_END_MESSAGE,
  SMS_BROWSE_LAST_FOOTER,
  SMS_BROWSE_MORE_FOOTER,
  SMS_BALLOT_UNAVAILABLE_MESSAGE,
  SMS_BROWSE_START_MESSAGE,
  SMS_INFO_NEEDS_CODE_MESSAGE,
  SMS_INFO_NEEDS_DECISION_MESSAGE,
  SMS_MOVE_USAGE_MESSAGE,
  SMS_PROPOSALS_NEEDS_DECISION_MESSAGE,
  SMS_REMOVE_USAGE_MESSAGE,
  SMS_VOTE_NEEDS_DECISION_MESSAGE,
  type SmsBallotPage,
  type SmsBallotSummary,
  UnauthorizedError,
  ValidationError,
  VoterNotEnrolledError,
  addSmsBallotPicks,
  affirmVoterAttestation,
  deleteBallotDraft,
  findCastBallot,
  findLatestCastBallotInstance,
  clipSmsText,
  describeEnrolmentDecision,
  findChatSession,
  findLatestChatSession,
  findPendingVoterEnrolment,
  findBallotDraft,
  findVoterEnrolment,
  formatUnitAmount,
  isVoterEnrolled,
  pendingEnrolmentStep,
  formatSmsAddressLookupFailed,
  formatSmsAddressNotFound,
  formatSmsAddressOutside,
  formatSmsAddressResolved,
  formatSmsBallot,
  formatSmsBallotPageHeading,
  formatSmsBallotRefused,
  formatSmsBallotScope,
  formatSmsDecisionInfo,
  formatSmsDecisionList,
  formatSmsEnrolled,
  formatSmsEnrolmentWelcome,
  formatSmsNoEnrolmentNeeded,
  formatSmsNotOnYourBallot,
  formatSmsNothingToAffirm,
  formatSmsPickDuplicate,
  formatSmsPickLimitReached,
  formatSmsPickMoved,
  formatSmsPickOverBudget,
  formatSmsPickRemoved,
  formatSmsPicksAdded,
  formatSmsProposalInfo,
  formatSmsProposalNotOnBallot,
  formatSmsProposalPage,
  formatSmsRegisterFirst,
  formatSmsVotingClosed,
  getSmsBallotProposal,
  getSmsBallotState,
  getSmsDecisionDescription,
  getSmsVotingDecision,
  listSmsBallotPage,
  setSessionPageCursor,
  listSmsDecisions,
  moveSmsBallotPick,
  removeSmsBallotPick,
  reopenSmsBallot,
  resolveVoterAddress,
  startVoterEnrolment,
  submitSmsBallot,
  summarizeSmsBallot,
} from '@op/common';
import { Events, inngest } from '@op/events';
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

const deliverAll = async ({
  deliver,
  stepId,
  label,
  bodies,
  message,
}: {
  deliver: SmsDeliver;
  stepId: string;
  label: string;
  bodies: string[];
  message: string;
}): Promise<SmsCommandResult> => {
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
  echoedSlug: string | null,
): Promise<SmsCommandResult> =>
  deliverAll({
    deliver,
    stepId: 'send-not-found-reply',
    label: 'Not-found reply',
    bodies: [
      echoedSlug === null
        ? 'No decision was found.'
        : `No decision named "${clipSmsText(echoedSlug, SMS_SLUG_LENGTH)}" was found.`,
    ],
    message: 'decision not found',
  });

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
  const result = await deliverAll({
    deliver,
    stepId: 'send-decision-list',
    label: 'Decision list',
    bodies: formatSmsDecisionList(decisions),
    message: 'decisions sent',
  });
  return result.message === 'decisions sent'
    ? { ...result, count: decisions.length }
    : result;
};

const describeDecision = async (
  { step, account, deliver }: SmsCommandContext,
  decisionSlug: string,
  echoSlug: boolean,
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
    return notFoundReply(deliver, echoSlug ? decisionSlug : null);
  }

  const failed = await deliver(
    'send-decision-reply',
    'Decision reply',
    formatSmsDecisionInfo(decision),
  );
  return failed ?? { message: 'decision sent' };
};

export const show: SmsCommandHandler = (context) => {
  if (context.argument) {
    return describeDecision(context, context.argument, true);
  }
  if (context.line?.slug) {
    return describeDecision(context, context.line.slug, false);
  }
  return listDecisions(context);
};

export const vote: SmsCommandHandler = async (context) => {
  const { step, account, deliver } = context;
  const slug = context.argument ?? context.line?.slug;

  if (!slug) {
    return deliverAll({
      deliver,
      stepId: 'send-vote-needs-decision',
      label: 'Vote needs a decision',
      bodies: [SMS_VOTE_NEEDS_DECISION_MESSAGE],
      message: 'vote needs a decision',
    });
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
    return notFoundReply(deliver, context.argument);
  }

  if (!decision.votingOpen) {
    return deliverAll({
      deliver,
      stepId: 'send-voting-closed',
      label: 'Voting closed reply',
      bodies: formatSmsVotingClosed(decision.name),
      message: 'voting closed',
    });
  }

  const rule = decision.enrolment;

  if (!rule) {
    return deliverAll({
      deliver,
      stepId: 'send-no-enrolment-needed',
      label: 'No enrolment needed reply',
      bodies: formatSmsNoEnrolmentNeeded(decision.name),
      message: 'no enrolment needed',
    });
  }

  const key = {
    processInstanceId: decision.instanceId,
    authUserId: account.authUserId,
  };
  const pending = await step.run('find-pending-enrolment', () =>
    findPendingVoterEnrolment(key),
  );

  const resendAttestation = (termLabel: string | null, message: string) =>
    deliverAll({
      deliver,
      stepId: 'send-attestation-again',
      label: 'Attestation reply',
      bodies: formatSmsAddressResolved({
        termLabel,
        decisionName: decision.name,
        attestation: rule.attestation,
      }),
      message,
    });

  if (pending) {
    const waitingOn = await step.run('derive-enrolment-step', () =>
      pendingEnrolmentStep({
        processInstanceId: decision.instanceId,
        taxonomyTermId: pending.taxonomyTermId,
        rule,
      }),
    );
    if (waitingOn === 'awaiting_agree') {
      return resendAttestation(pending.termLabel, 'attestation resent');
    }
    return deliverAll({
      deliver,
      stepId: 'send-enrolment-welcome',
      label: 'Registration welcome',
      bodies: formatSmsEnrolmentWelcome(decision.name),
      message: 'enrolment started',
    });
  }

  const existing = await step.run('find-enrolment', () =>
    findVoterEnrolment(key),
  );

  if (isVoterEnrolled(existing)) {
    return deliverAll({
      deliver,
      stepId: 'send-already-enrolled',
      label: 'Already registered reply',
      bodies: formatSmsEnrolled({
        decisionName: decision.name,
        termLabel: null,
        budget: decision.budget,
      }),
      message: 'already enrolled',
    });
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

  return deliverAll({
    deliver,
    stepId: 'send-enrolment-welcome',
    label: 'Registration welcome',
    bodies: formatSmsEnrolmentWelcome(decision.name),
    message: 'enrolment started',
  });
};

export const agree: SmsCommandHandler = async (context) => {
  const { step, account, deliver } = context;
  const nothingToAffirm = () =>
    deliverAll({
      deliver,
      stepId: 'send-nothing-to-affirm',
      label: 'Nothing to affirm reply',
      bodies: formatSmsNothingToAffirm(),
      message: 'nothing to affirm',
    });

  const pending = await step.run('find-pending-enrolment', () =>
    findPendingVoterEnrolment({ authUserId: account.authUserId }),
  );

  if (!pending) {
    return nothingToAffirm();
  }

  const decision = await step.run('describe-enrolment-decision', () =>
    swallowUnreadable(() =>
      describeEnrolmentDecision({
        instanceId: pending.processInstanceId,
        authUserId: account.authUserId,
      }),
    ),
  );
  const rule = decision?.enrolment;

  if (!decision || !rule || !decision.votingOpen) {
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

  return deliverAll({
    deliver,
    stepId: 'send-enrolled',
    label: 'Registered reply',
    bodies: formatSmsEnrolled({
      decisionName: decision.name,
      termLabel: pending.termLabel,
      budget: decision.budget,
    }),
    message: 'enrolled',
  });
};

// Free text is an address while a registration waits for one, and proposal
// codes otherwise. On a decision line, codes win over a registration that
// belongs to another decision, so one unfinished registration elsewhere never
// swallows a vote here.
export const freeText: SmsCommandHandler = async (context) => {
  const { step, account, line, deliver, geocode } = context;
  const address = context.body?.trim();

  if (!address) {
    return sendSmsHelp(deliver);
  }

  const pending = await step.run('find-pending-enrolment', () =>
    findPendingVoterEnrolment({ authUserId: account.authUserId }),
  );
  const codes = parseProposalCodes(address);
  const pendingElsewhere =
    line !== null &&
    pending !== null &&
    pending.processInstanceId !== line.instanceId;

  const codesOrHelp = () =>
    codes ? pickByCodes(context, codes) : sendSmsHelp(deliver);

  if (!pending || (codes && pendingElsewhere)) {
    return codesOrHelp();
  }

  const decision = await step.run('describe-enrolment-decision', () =>
    swallowUnreadable(() =>
      describeEnrolmentDecision({
        instanceId: pending.processInstanceId,
        authUserId: account.authUserId,
      }),
    ),
  );
  const rule = decision?.enrolment;

  if (!decision || !rule || !decision.votingOpen) {
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
    return codesOrHelp();
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
      return deliverAll({
        deliver,
        stepId: 'send-address-not-found',
        label: 'Address not found reply',
        bodies: formatSmsAddressNotFound(),
        message: 'address not found',
      });
    case 'lookup_failed':
      return deliverAll({
        deliver,
        stepId: 'send-address-lookup-failed',
        label: 'Address lookup failed reply',
        bodies: formatSmsAddressLookupFailed(),
        message: 'address lookup failed',
      });
    case 'outside':
      return deliverAll({
        deliver,
        stepId: 'send-address-outside',
        label: 'Address outside reply',
        bodies: formatSmsAddressOutside(decision.name),
        message: 'address outside',
      });
    case 'resolved':
      return deliverAll({
        deliver,
        stepId: 'send-attestation',
        label: 'Attestation reply',
        bodies: formatSmsAddressResolved({
          termLabel: resolution.boundary?.name ?? null,
          decisionName: decision.name,
          attestation: rule.attestation,
        }),
        message: 'address resolved',
      });
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
      ? deliverAll({
          deliver,
          stepId: 'send-ballot-page',
          label: 'Ballot page',
          bodies: formatSmsProposalPage({ items: [], hasMore: false }),
          message: 'ballot empty',
        })
      : deliverAll({
          deliver,
          stepId: 'send-browse-ended',
          label: 'Browse ended reply',
          bodies: [SMS_BROWSE_END_MESSAGE],
          message: 'browse ended',
        });
  }

  const hasMore = page.nextCursor !== null;

  return deliverAll({
    deliver,
    stepId: 'send-ballot-page',
    label: 'Ballot page',
    bodies: formatSmsProposalPage({
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
    message: kind === 'first' ? 'ballot page sent' : 'next ballot page sent',
  });
};

export const proposals: SmsCommandHandler = async (context) => {
  const { step, account, deliver } = context;
  const slug = context.argument ?? context.line?.slug;

  if (!slug) {
    return deliverAll({
      deliver,
      stepId: 'send-proposals-needs-decision',
      label: 'Proposals needs a decision',
      bodies: [SMS_PROPOSALS_NEEDS_DECISION_MESSAGE],
      message: 'proposals needs a decision',
    });
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
    return deliverAll({
      deliver,
      stepId: 'send-voting-closed',
      label: 'Voting closed reply',
      bodies: formatSmsVotingClosed(decision.name),
      message: 'voting closed',
    });
  }

  if (decision.enrolment) {
    const enrolment = await step.run('find-enrolment', () =>
      findVoterEnrolment({
        processInstanceId: decision.instanceId,
        authUserId: account.authUserId,
      }),
    );

    if (!isVoterEnrolled(enrolment)) {
      return deliverAll({
        deliver,
        stepId: 'send-register-first',
        label: 'Register first reply',
        bodies: [formatSmsRegisterFirst(decision.name, context.argument)],
        message: 'register first',
      });
    }
  }

  const page = await step.run('list-ballot-page', () =>
    readBallot(() =>
      listSmsBallotPage({
        authUserId: account.authUserId,
        instanceId: decision.instanceId,
        phoneNumberId: context.line?.id,
      }),
    ),
  );

  return page.ok
    ? deliverBallotPage(context, page.value, 'first', decision.instanceId)
    : refuseBallotRead(context, page, decision.instanceId);
};

type BallotRefusal =
  | { reason: 'unavailable' | 'not_enrolled' | 'closed' }
  | { reason: 'unpriced'; message: string };

type BallotRead<T> = { ok: true; value: T } | ({ ok: false } & BallotRefusal);

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
    if (error instanceof BallotCostError) {
      return { ok: false, reason: 'unpriced', message: error.message };
    }
    if (error instanceof ValidationError) {
      return { ok: false, reason: 'closed' };
    }
    throw error;
  }
};

const refuseBallotRead = async (
  { step, account, deliver, line }: SmsCommandContext,
  refusal: BallotRefusal,
  instanceId: string,
): Promise<SmsCommandResult> => {
  const { reason } = refusal;
  if (refusal.reason === 'unpriced') {
    return deliverAll({
      deliver,
      stepId: 'send-ballot-unpriced',
      label: 'Ballot unpriced reply',
      bodies: [refusal.message],
      message: 'ballot unpriced',
    });
  }
  if (reason === 'unavailable') {
    return deliverAll({
      deliver,
      stepId: 'send-ballot-unavailable',
      label: 'Ballot unavailable reply',
      bodies: [SMS_BALLOT_UNAVAILABLE_MESSAGE],
      message: 'decision not found',
    });
  }
  const decision = await step.run('describe-refused-decision', () =>
    swallowUnreadable(() =>
      describeEnrolmentDecision({ instanceId, authUserId: account.authUserId }),
    ),
  );
  if (!decision) {
    return deliverAll({
      deliver,
      stepId: 'send-ballot-unavailable',
      label: 'Ballot unavailable reply',
      bodies: [SMS_BALLOT_UNAVAILABLE_MESSAGE],
      message: 'decision not found',
    });
  }
  return reason === 'closed'
    ? deliverAll({
        deliver,
        stepId: 'send-voting-closed',
        label: 'Voting closed reply',
        bodies: formatSmsVotingClosed(decision.name),
        message: 'voting closed',
      })
    : deliverAll({
        deliver,
        stepId: 'send-register-first',
        label: 'Register first reply',
        bodies: [
          formatSmsRegisterFirst(
            decision.name,
            line?.instanceId === instanceId ? null : decision.slug,
          ),
        ],
        message: 'register first',
      });
};

const deliverBallotPage = async (
  { step, account, deliver }: SmsCommandContext,
  page: SmsBallotPage,
  kind: 'first' | 'next',
  instanceId: string,
): Promise<SmsCommandResult> => {
  const sent = await sendBallotPage(deliver, page, kind);
  if (sent.message !== 'reply rejected') {
    await step.run(`save-page-cursor-${kind}`, () =>
      setSessionPageCursor({
        processInstanceId: instanceId,
        authUserId: account.authUserId,
        pageCursor: page.nextCursor,
      }),
    );
  }
  return sent;
};

const resolveBrowseInstance = async ({
  step,
  account,
  line,
}: SmsCommandContext): Promise<string | null> => {
  const session = await step.run('find-latest-session', () =>
    findLatestChatSession({
      authUserId: account.authUserId,
      ...(line ? { phoneNumberId: line.id } : {}),
    }),
  );
  return session?.processInstanceId ?? line?.instanceId ?? null;
};

export const more: SmsCommandHandler = async (context) => {
  const { step, account, deliver } = context;
  const instanceId = await resolveBrowseInstance(context);
  const session = instanceId
    ? await step.run('find-chat-session', () =>
        findChatSession({
          processInstanceId: instanceId,
          authUserId: account.authUserId,
        }),
      )
    : null;

  if (!session || session.pageCursor === null) {
    return deliverAll({
      deliver,
      stepId: 'send-browse-start',
      label: 'Browse start reply',
      bodies: [SMS_BROWSE_START_MESSAGE],
      message: 'browse not started',
    });
  }

  const after = session.pageCursor;
  const page = await step.run('list-ballot-page', () =>
    readBallot(() =>
      listSmsBallotPage({
        authUserId: account.authUserId,
        instanceId: session.processInstanceId,
        after,
      }),
    ),
  );

  return page.ok
    ? deliverBallotPage(context, page.value, 'next', session.processInstanceId)
    : refuseBallotRead(context, page, session.processInstanceId);
};

export const info: SmsCommandHandler = async (context) => {
  const { step, account, deliver } = context;
  const code =
    context.argument && PROPOSAL_CODE_PATTERN.test(context.argument)
      ? Number(context.argument)
      : null;

  if (code === null) {
    return deliverAll({
      deliver,
      stepId: 'send-info-needs-code',
      label: 'Info needs a code',
      bodies: [SMS_INFO_NEEDS_CODE_MESSAGE],
      message: 'info needs a code',
    });
  }

  const instanceId = await resolveBrowseInstance(context);

  if (!instanceId) {
    return deliverAll({
      deliver,
      stepId: 'send-info-needs-decision',
      label: 'Info needs a decision',
      bodies: [SMS_INFO_NEEDS_DECISION_MESSAGE],
      message: 'info needs a decision',
    });
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
    return refuseBallotRead(context, read, instanceId);
  }

  const proposal = read.value;

  if (!proposal) {
    return deliverAll({
      deliver,
      stepId: 'send-proposal-not-on-ballot',
      label: 'Proposal not on ballot reply',
      bodies: [formatSmsProposalNotOnBallot(code)],
      message: 'proposal not on ballot',
    });
  }

  return deliverAll({
    deliver,
    stepId: 'send-proposal-info',
    label: 'Proposal info',
    bodies: formatSmsProposalInfo(proposal),
    message: 'proposal info sent',
  });
};

const parseProposalCodes = (body: string): number[] | null => {
  const tokens = body.split(/[\s,]+/).filter(Boolean);
  if (
    tokens.length === 0 ||
    !tokens.every((t) => PROPOSAL_CODE_PATTERN.test(t))
  ) {
    return null;
  }
  return [...new Set(tokens.map(Number))];
};

const formatMoney = (
  summary: SmsBallotSummary,
  amount: number | null,
): string | null =>
  summary.unit && amount !== null
    ? formatUnitAmount({ amount, unit: summary.unit })
    : null;

// The same choice as a browse, then the ballot the voter cast last on the
// shared number, so CHANGE and a second SUBMIT find it after the draft is gone.
const resolveBallotInstance = async (
  context: SmsCommandContext,
): Promise<string | null> => {
  const { step, account, line } = context;
  const fromBrowse = await resolveBrowseInstance(context);
  if (fromBrowse || line) {
    return fromBrowse;
  }
  return step.run('find-latest-cast-ballot', () =>
    findLatestCastBallotInstance({ authUserId: account.authUserId }),
  );
};

const refuseIfBallotCast = async (
  { step, account, deliver }: SmsCommandContext,
  instanceId: string,
): Promise<SmsCommandResult | null> => {
  const castId = await step.run('find-cast-ballot', () =>
    findCastBallot({ authUserId: account.authUserId, instanceId }),
  );
  return castId
    ? deliverAll({
        deliver,
        stepId: 'send-ballot-cast-guard',
        label: 'Ballot already in reply',
        bodies: [SMS_BALLOT_ALREADY_SUBMITTED_MESSAGE],
        message: 'ballot already submitted',
      })
    : null;
};

const refuseUnlessReadyToPick = async (
  { step, account, deliver, line }: SmsCommandContext,
  instanceId: string,
): Promise<SmsCommandResult | null> => {
  const decision = await step.run('describe-ballot-decision', () =>
    swallowUnreadable(() =>
      describeEnrolmentDecision({ instanceId, authUserId: account.authUserId }),
    ),
  );

  if (!decision) {
    return deliverAll({
      deliver,
      stepId: 'send-ballot-unavailable',
      label: 'Ballot unavailable reply',
      bodies: [SMS_BALLOT_UNAVAILABLE_MESSAGE],
      message: 'decision not found',
    });
  }

  if (!decision.votingOpen) {
    return deliverAll({
      deliver,
      stepId: 'send-voting-closed',
      label: 'Voting closed reply',
      bodies: formatSmsVotingClosed(decision.name),
      message: 'voting closed',
    });
  }

  if (decision.enrolment) {
    const enrolment = await step.run('find-enrolment', () =>
      findVoterEnrolment({
        processInstanceId: instanceId,
        authUserId: account.authUserId,
      }),
    );
    if (!isVoterEnrolled(enrolment)) {
      return deliverAll({
        deliver,
        stepId: 'send-register-first',
        label: 'Register first reply',
        bodies: [
          formatSmsRegisterFirst(
            decision.name,
            line?.instanceId === instanceId ? null : decision.slug,
          ),
        ],
        message: 'register first',
      });
    }
  }

  return null;
};

const sendBallotNeedsDecision = (deliver: SmsDeliver) =>
  deliverAll({
    deliver,
    stepId: 'send-ballot-needs-decision',
    label: 'Ballot needs a decision',
    bodies: [SMS_BALLOT_NEEDS_DECISION_MESSAGE],
    message: 'ballot needs a decision',
  });

const pickByCodes = async (
  context: SmsCommandContext,
  codes: number[],
): Promise<SmsCommandResult> => {
  const { step, account, deliver } = context;
  const instanceId = await resolveBallotInstance(context);

  if (!instanceId) {
    return sendBallotNeedsDecision(deliver);
  }

  const cast = await refuseIfBallotCast(context, instanceId);
  if (cast) {
    return cast;
  }

  const refused = await refuseUnlessReadyToPick(context, instanceId);
  if (refused) {
    return refused;
  }

  const state = await step.run('ballot-state', () =>
    getSmsBallotState({ authUserId: account.authUserId, instanceId }),
  );
  if (state.submitted && !state.draftOpen) {
    return deliverAll(
      deliver,
      'send-change-first',
      'Change first reply',
      [SMS_BALLOT_CHANGE_FIRST_MESSAGE],
      'ballot already in',
    );
  }

  const picked = await step.run('add-ballot-picks', () =>
    readBallot(() =>
      addSmsBallotPicks({
        authUserId: account.authUserId,
        instanceId,
        codes,
        phoneNumberId: context.line?.id,
      }),
    ),
  );

  if (!picked.ok) {
    return refuseBallotRead(context, picked, instanceId);
  }

  const { results, summary, hadPicks } = picked.value;
  const added = results.flatMap((r) => (r.status === 'added' ? [r] : []));
  const lines = [
    ...(added.length > 0
      ? formatSmsPicksAdded({
          picks: added.map(({ position, pick }) => ({
            position,
            code: pick.code,
            title: pick.title,
            cost: formatMoney(summary, pick.cost),
          })),
          remaining: formatMoney(summary, summary.remaining),
          firstPick: !hadPicks,
        })
      : []),
    ...results.flatMap((r) => {
      switch (r.status) {
        case 'added':
          return [];
        case 'over_budget':
          return formatSmsPickOverBudget({
            title: r.pick.title,
            cost: formatMoney(summary, r.pick.cost) ?? '',
            remaining: formatMoney(summary, r.remaining) ?? '',
          });
        case 'duplicate':
          return formatSmsPickDuplicate({
            title: r.pick.title,
            position: r.position,
          });
        case 'limit_reached':
          return formatSmsPickLimitReached({
            title: r.pick.title,
            limit: r.limit,
          });
        case 'unknown':
          return formatSmsProposalNotOnBallot(r.code);
      }
    }),
  ];
  const message =
    added.length > 0
      ? 'picks added'
      : results.some((r) => r.status === 'over_budget')
        ? 'pick over budget'
        : results.some((r) => r.status === 'limit_reached')
          ? 'pick limit reached'
          : results.some((r) => r.status === 'duplicate')
            ? 'pick repeated'
            : 'proposal not on ballot';

  return deliverAll({
    deliver,
    stepId: 'send-picks',
    label: 'Picks reply',
    bodies: lines,
    message,
  });
};

const sendBallot = async (
  context: SmsCommandContext,
  review: boolean,
): Promise<SmsCommandResult> => {
  const { step, account, deliver } = context;
  const instanceId = await resolveBallotInstance(context);

  if (!instanceId) {
    return sendBallotNeedsDecision(deliver);
  }

  const cast = await refuseIfBallotCast(context, instanceId);
  if (cast) {
    return cast;
  }

  const read = await step.run('summarize-ballot', () =>
    readBallot(() =>
      summarizeSmsBallot({ authUserId: account.authUserId, instanceId }),
    ),
  );

  if (!read.ok) {
    return refuseBallotRead(context, read, instanceId);
  }

  const summary = read.value;

  return deliverAll({
    deliver,
    stepId: 'send-ballot',
    label: review ? 'Ballot review' : 'Ballot list',
    bodies: formatSmsBallot({
      scope: formatSmsBallotScope(summary),
      picks: summary.picks.map((pick, index) => ({
        position: index + 1,
        code: pick.code,
        title: pick.title,
        cost: formatMoney(summary, pick.cost),
      })),
      allocated: formatMoney(summary, summary.allocated),
      unspent: formatMoney(summary, summary.remaining),
      review,
      ranked: summary.ranked,
    }),
    message: review ? 'ballot reviewed' : 'ballot sent',
  });
};

export const list: SmsCommandHandler = (context) => sendBallot(context, false);

export const done: SmsCommandHandler = (context) => sendBallot(context, true);

export const remove: SmsCommandHandler = async (context) => {
  const { step, account, deliver } = context;
  const code =
    context.argument && PROPOSAL_CODE_PATTERN.test(context.argument)
      ? Number(context.argument)
      : null;

  if (code === null) {
    return deliverAll({
      deliver,
      stepId: 'send-remove-usage',
      label: 'Remove usage',
      bodies: [SMS_REMOVE_USAGE_MESSAGE],
      message: 'remove needs a code',
    });
  }

  const instanceId = await resolveBallotInstance(context);
  if (!instanceId) {
    return sendBallotNeedsDecision(deliver);
  }

  const cast = await refuseIfBallotCast(context, instanceId);
  if (cast) {
    return cast;
  }

  const removed = await step.run('remove-ballot-pick', () =>
    readBallot(() =>
      removeSmsBallotPick({ authUserId: account.authUserId, instanceId, code }),
    ),
  );

  if (!removed.ok) {
    return refuseBallotRead(context, removed, instanceId);
  }

  const { change, summary } = removed.value;

  return change.status === 'not_on_ballot'
    ? deliverAll({
        deliver,
        stepId: 'send-not-on-ballot',
        label: 'Not on ballot reply',
        bodies: [formatSmsNotOnYourBallot(code)],
        message: 'pick not on ballot',
      })
    : deliverAll({
        deliver,
        stepId: 'send-pick-removed',
        label: 'Pick removed reply',
        bodies: [
          formatSmsPickRemoved({
            title: change.pick.title,
            remaining: formatMoney(summary, summary.remaining),
          }),
        ],
        message: 'pick removed',
      });
};

export const move: SmsCommandHandler = async (context) => {
  const { step, account, deliver } = context;
  const [codeText, positionText, ...rest] = (context.argument ?? '')
    .split(/\s+/)
    .filter(Boolean);
  const code =
    codeText && PROPOSAL_CODE_PATTERN.test(codeText) ? Number(codeText) : null;
  const position =
    positionText && /^\d{1,3}$/.test(positionText)
      ? Number(positionText)
      : null;

  if (code === null || position === null || position < 1 || rest.length > 0) {
    return deliverAll({
      deliver,
      stepId: 'send-move-usage',
      label: 'Move usage',
      bodies: [SMS_MOVE_USAGE_MESSAGE],
      message: 'move needs a code and a position',
    });
  }

  const instanceId = await resolveBallotInstance(context);
  if (!instanceId) {
    return sendBallotNeedsDecision(deliver);
  }

  const cast = await refuseIfBallotCast(context, instanceId);
  if (cast) {
    return cast;
  }

  const moved = await step.run('move-ballot-pick', () =>
    readBallot(() =>
      moveSmsBallotPick({
        authUserId: account.authUserId,
        instanceId,
        code,
        position,
      }),
    ),
  );

  if (!moved.ok) {
    return refuseBallotRead(context, moved, instanceId);
  }

  const { change } = moved.value;

  return change.status === 'not_on_ballot'
    ? deliverAll({
        deliver,
        stepId: 'send-not-on-ballot',
        label: 'Not on ballot reply',
        bodies: [formatSmsNotOnYourBallot(code)],
        message: 'pick not on ballot',
      })
    : deliverAll({
        deliver,
        stepId: 'send-pick-moved',
        label: 'Pick moved reply',
        bodies: [
          formatSmsPickMoved({
            title: change.pick.title,
            position: change.position,
          }),
        ],
        message: 'pick moved',
      });
};

export const submit: SmsCommandHandler = async (context) => {
  const { step, account, deliver, line } = context;
  const instanceId = await resolveBallotInstance(context);

  if (!instanceId) {
    return sendBallotNeedsDecision(deliver);
  }

  const submission = await step.run('submit-ballot', () =>
    submitSmsBallot({ authUserId: account.authUserId, instanceId }),
  );

  // The follow-ups run on a retry too: a run that stopped after submitVote
  // committed comes back as already_submitted with the same submission id, and
  // the event id keeps Inngest from firing twice for one ballot.
  const finishSubmission = async (
    voteSubmissionId: string,
    revised: boolean,
  ) => {
    await step.run('clear-ballot-draft', () =>
      deleteBallotDraft({ authUserId: account.authUserId, instanceId }),
    );
    await step.run('send-vote-event', () =>
      inngest.send({
        id: `vote-${revised ? 'revised' : 'submitted'}-${voteSubmissionId}`,
        name: revised ? Events.voteRevised.name : Events.voteSubmitted.name,
        data: { voteSubmissionId, processInstanceId: instanceId },
      }),
    );
  };

  switch (submission.status) {
    case 'submitted':
    case 'revised': {
      const revised = submission.status === 'revised';
      await finishSubmission(submission.voteSubmissionId, revised);
      return deliverAll({
        deliver,
        stepId: revised ? 'send-ballot-updated' : 'send-ballot-submitted',
        label: revised ? 'Ballot updated reply' : 'Ballot submitted reply',
        bodies: [
          revised ? SMS_BALLOT_UPDATED_MESSAGE : SMS_BALLOT_SUBMITTED_MESSAGE,
        ],
        message: revised ? 'ballot revised' : 'ballot submitted',
      });
    }
    case 'already_submitted': {
      const draft = await step.run('find-stale-draft', () =>
        findBallotDraft({
          processInstanceId: instanceId,
          authUserId: account.authUserId,
        }),
      );
      if (draft) {
        await finishSubmission(submission.voteSubmissionId, false);
      }
      return deliverAll({
        deliver,
        stepId: 'send-ballot-already-in',
        label: 'Ballot already in reply',
        bodies: [SMS_BALLOT_ALREADY_SUBMITTED_MESSAGE],
        message: 'ballot already submitted',
      });
    }
    case 'empty':
      return deliverAll({
        deliver,
        stepId: 'send-ballot-empty',
        label: 'Ballot empty reply',
        bodies: [SMS_BALLOT_EMPTY_SUBMIT_MESSAGE],
        message: 'ballot empty',
      });
    case 'unavailable':
      return deliverAll({
        deliver,
        stepId: 'send-ballot-unavailable',
        label: 'Ballot unavailable reply',
        bodies: [SMS_BALLOT_UNAVAILABLE_MESSAGE],
        message: 'decision not found',
      });
    case 'not_enrolled': {
      const decision = await step.run('describe-register-decision', () =>
        swallowUnreadable(() =>
          describeEnrolmentDecision({
            instanceId,
            authUserId: account.authUserId,
          }),
        ),
      );
      if (!decision) {
        return deliverAll({
          deliver,
          stepId: 'send-ballot-unavailable',
          label: 'Ballot unavailable reply',
          bodies: [SMS_BALLOT_UNAVAILABLE_MESSAGE],
          message: 'decision not found',
        });
      }
      return deliverAll({
        deliver,
        stepId: 'send-register-first',
        label: 'Register first reply',
        bodies: [
          formatSmsRegisterFirst(
            decision.name,
            line?.instanceId === instanceId ? null : decision.slug,
          ),
        ],
        message: 'register first',
      });
    }
    case 'outside_scope':
      return deliverAll({
        deliver,
        stepId: 'send-ballot-outside-scope',
        label: 'Ballot outside scope reply',
        bodies: [SMS_BALLOT_OUTSIDE_SCOPE_MESSAGE],
        message: 'ballot outside scope',
      });
    case 'not_allowed':
      return deliverAll({
        deliver,
        stepId: 'send-change-not-allowed',
        label: 'Change not allowed reply',
        bodies: [SMS_BALLOT_CHANGE_NOT_ALLOWED_MESSAGE],
        message: 'change not allowed',
      });
    case 'refused':
      return deliverAll({
        deliver,
        stepId: 'send-ballot-refused',
        label: 'Ballot refused reply',
        bodies: [formatSmsBallotRefused(submission.reason)],
        message: 'ballot refused',
      });
  }
};

export const change: SmsCommandHandler = async (context) => {
  const { step, account, deliver } = context;
  const instanceId = await resolveBallotInstance(context);

  if (!instanceId) {
    return ballotNeedsDecision(deliver);
  }

  const reopened = await step.run('reopen-ballot', () =>
    reopenSmsBallot({ authUserId: account.authUserId, instanceId }),
  );

  switch (reopened.status) {
    case 'no_ballot':
      return deliverAll(
        deliver,
        'send-ballot-not-cast',
        'Ballot not cast reply',
        [SMS_BALLOT_NOT_CAST_MESSAGE],
        'no ballot to change',
      );
    case 'voting_closed': {
      const decision = await step.run('describe-ballot-decision', () =>
        describeEnrolmentDecision({ instanceId }),
      );
      return deliverAll(
        deliver,
        'send-voting-closed',
        'Voting closed reply',
        formatSmsVotingClosed(decision.name),
        'voting closed',
      );
    }
    case 'not_allowed':
      return deliverAll(
        deliver,
        'send-change-not-allowed',
        'Change not allowed reply',
        [SMS_BALLOT_CHANGE_NOT_ALLOWED_MESSAGE],
        'change not allowed',
      );
    case 'reopened': {
      const { summary } = reopened;
      return deliverAll(
        deliver,
        'send-ballot-reopened',
        'Ballot reopened reply',
        [
          SMS_BALLOT_REOPENED_MESSAGE,
          ...formatSmsBallot({
            scope: formatSmsBallotScope(summary),
            picks: summary.picks.map((pick, index) => ({
              position: index + 1,
              title: pick.title,
              cost: money(summary, pick.cost),
            })),
            allocated: money(summary, summary.allocated),
            unspent: money(summary, summary.remaining),
            review: false,
          }),
        ],
        'ballot reopened',
      );
    }
  }
};
