import {
  type Geocode,
  BallotCostError,
  NotFoundError,
  SMS_BALLOT_ALREADY_SUBMITTED_MESSAGE,
  SMS_BALLOT_CHANGE_FIRST_MESSAGE,
  SMS_BALLOT_CHANGE_NOT_ALLOWED_MESSAGE,
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
  findLatestCastBallotInstance,
  clipSmsText,
  describeEnrolmentDecision,
  findBallotDraft,
  findChatSession,
  findLatestChatSession,
  findPendingVoterEnrolment,
  findVoterEnrolment,
  isVoterEnrolled,
  pendingEnrolmentStep,
  formatSmsAddressNotFound,
  formatSmsAddressOutside,
  formatSmsAddressResolved,
  formatSmsAmount,
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
  /** The inbound text's Twilio id; it keys anything that must happen once per text. */
  messageSid: string;
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

  if (!pending || (codes && pendingElsewhere)) {
    return codes ? pickByCodes(context, codes) : sendSmsHelp(deliver);
  }

  const decision = await step.run('describe-enrolment-decision', () =>
    describeEnrolmentDecision({ instanceId: pending.processInstanceId }),
  );
  const rule = decision.enrolment;

  if (!rule) {
    return codes ? pickByCodes(context, codes) : sendSmsHelp(deliver);
  }

  const waitingOn = await step.run('derive-enrolment-step', () =>
    pendingEnrolmentStep({
      processInstanceId: pending.processInstanceId,
      taxonomyTermId: pending.taxonomyTermId,
      rule,
    }),
  );

  if (waitingOn !== 'awaiting_address') {
    return codes ? pickByCodes(context, codes) : sendSmsHelp(deliver);
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

    if (!isVoterEnrolled(enrolment)) {
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
        phoneNumberId: context.line?.id ?? null,
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
  { step, deliver, line }: SmsCommandContext,
  refusal: BallotRefusal,
  instanceId: string,
): Promise<SmsCommandResult> => {
  const { reason } = refusal;
  if (refusal.reason === 'unpriced') {
    return deliverAll(
      deliver,
      'send-ballot-unpriced',
      'Ballot unpriced reply',
      [refusal.message],
      'ballot unpriced',
    );
  }
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
        [
          formatSmsRegisterFirst(
            decision.name,
            line?.instanceId === instanceId ? null : decision.slug,
          ),
        ],
        'register first',
      );
};

// The cursor moves only once the page went out, so a reply the carrier
// refused is sent again on the next MORE instead of being skipped.
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

// On a decision line the line's own decision is the default; a decision the
// voter browsed by slug on that same line overrides it, and a session browsed
// on another line never does. On the shared number the latest session wins.
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
    return deliverAll(
      deliver,
      'send-browse-start',
      'Browse start reply',
      [SMS_BROWSE_START_MESSAGE],
      'browse not started',
    );
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
    return refuseBallotRead(context, read, instanceId);
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

const money = (
  summary: SmsBallotSummary,
  amount: number | null,
): string | null =>
  summary.unit && amount !== null
    ? formatSmsAmount({ amount, unit: summary.unit })
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

const refuseUnlessReadyToPick = async (
  { step, account, deliver, line }: SmsCommandContext,
  instanceId: string,
): Promise<SmsCommandResult | null> => {
  const decision = await step.run('describe-ballot-decision', () =>
    describeEnrolmentDecision({ instanceId }),
  );

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
        processInstanceId: instanceId,
        authUserId: account.authUserId,
      }),
    );
    if (!isVoterEnrolled(enrolment)) {
      return deliverAll(
        deliver,
        'send-register-first',
        'Register first reply',
        [
          formatSmsRegisterFirst(
            decision.name,
            line?.instanceId === instanceId ? null : decision.slug,
          ),
        ],
        'register first',
      );
    }
  }

  return null;
};

const ballotNeedsDecision = (deliver: SmsDeliver) =>
  deliverAll(
    deliver,
    'send-ballot-needs-decision',
    'Ballot needs a decision',
    [SMS_BALLOT_NEEDS_DECISION_MESSAGE],
    'ballot needs a decision',
  );

const pickByCodes = async (
  context: SmsCommandContext,
  codes: number[],
): Promise<SmsCommandResult> => {
  const { step, account, deliver } = context;
  const instanceId = await resolveBallotInstance(context);

  if (!instanceId) {
    return ballotNeedsDecision(deliver);
  }

  const refused = await refuseUnlessReadyToPick(context, instanceId);
  if (refused) {
    return refused;
  }

  const castAndClosed = await refuseUntilChange(context, instanceId);
  if (castAndClosed) {
    return castAndClosed;
  }

  const picked = await step.run('add-ballot-picks', () =>
    readBallot(() =>
      addSmsBallotPicks({
        authUserId: account.authUserId,
        instanceId,
        codes,
        phoneNumberId: context.line?.id ?? null,
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
            cost: money(summary, pick.cost),
          })),
          remaining: money(summary, summary.remaining),
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
            cost: money(summary, r.pick.cost) ?? '',
            remaining: money(summary, r.remaining) ?? '',
          });
        case 'duplicate':
          return [
            formatSmsPickDuplicate({
              title: r.pick.title,
              position: r.position,
            }),
          ];
        case 'limit_reached':
          return [
            formatSmsPickLimitReached({ title: r.pick.title, limit: r.limit }),
          ];
        case 'unknown':
          return [formatSmsProposalNotOnBallot(r.code)];
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

  return deliverAll(deliver, 'send-picks', 'Picks reply', lines, message);
};

const refuseUntilChange = async (
  { step, account, deliver }: SmsCommandContext,
  instanceId: string,
): Promise<SmsCommandResult | null> => {
  const state = await step.run('ballot-state', () =>
    getSmsBallotState({ authUserId: account.authUserId, instanceId }),
  );
  return state.submitted && !state.reopened
    ? deliverAll(
        deliver,
        'send-change-first',
        'Change first reply',
        [SMS_BALLOT_CHANGE_FIRST_MESSAGE],
        'ballot already in',
      )
    : null;
};

const sendBallot = async (
  context: SmsCommandContext,
  review: boolean,
): Promise<SmsCommandResult> => {
  const { step, account, deliver } = context;
  const instanceId = await resolveBallotInstance(context);

  if (!instanceId) {
    return ballotNeedsDecision(deliver);
  }

  const castAndClosed = await refuseUntilChange(context, instanceId);
  if (castAndClosed) {
    return castAndClosed;
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

  return deliverAll(
    deliver,
    'send-ballot',
    review ? 'Ballot review' : 'Ballot list',
    formatSmsBallot({
      scope: formatSmsBallotScope(summary),
      picks: summary.picks.map((pick, index) => ({
        position: index + 1,
        code: pick.code,
        title: pick.title,
        cost: money(summary, pick.cost),
      })),
      allocated: money(summary, summary.allocated),
      unspent: money(summary, summary.remaining),
      review,
      ranked: summary.ranked,
    }),
    review ? 'ballot reviewed' : 'ballot sent',
  );
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
    return deliverAll(
      deliver,
      'send-remove-usage',
      'Remove usage',
      [SMS_REMOVE_USAGE_MESSAGE],
      'remove needs a code',
    );
  }

  const instanceId = await resolveBallotInstance(context);
  if (!instanceId) {
    return ballotNeedsDecision(deliver);
  }

  const castAndClosed = await refuseUntilChange(context, instanceId);
  if (castAndClosed) {
    return castAndClosed;
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
    ? deliverAll(
        deliver,
        'send-not-on-ballot',
        'Not on ballot reply',
        [formatSmsNotOnYourBallot(code)],
        'pick not on ballot',
      )
    : deliverAll(
        deliver,
        'send-pick-removed',
        'Pick removed reply',
        [
          formatSmsPickRemoved({
            title: change.pick.title,
            remaining: money(summary, summary.remaining),
          }),
        ],
        'pick removed',
      );
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
    return deliverAll(
      deliver,
      'send-move-usage',
      'Move usage',
      [SMS_MOVE_USAGE_MESSAGE],
      'move needs a code and a position',
    );
  }

  const instanceId = await resolveBallotInstance(context);
  if (!instanceId) {
    return ballotNeedsDecision(deliver);
  }

  const castAndClosed = await refuseUntilChange(context, instanceId);
  if (castAndClosed) {
    return castAndClosed;
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
    ? deliverAll(
        deliver,
        'send-not-on-ballot',
        'Not on ballot reply',
        [formatSmsNotOnYourBallot(code)],
        'pick not on ballot',
      )
    : deliverAll(
        deliver,
        'send-pick-moved',
        'Pick moved reply',
        [
          formatSmsPickMoved({
            title: change.pick.title,
            position: change.position,
          }),
        ],
        'pick moved',
      );
};

export const submit: SmsCommandHandler = async (context) => {
  const { step, account, deliver, line, messageSid } = context;
  const instanceId = await resolveBallotInstance(context);

  if (!instanceId) {
    return ballotNeedsDecision(deliver);
  }

  const submission = await step.run('submit-ballot', () =>
    submitSmsBallot({ authUserId: account.authUserId, instanceId }),
  );

  // The follow-ups run on a retry too: a run that stopped after submitVote
  // committed comes back as already_submitted with the same submission id, and
  // the event id keeps Inngest from firing twice for one ballot. A revision
  // keeps the submission id, so its event id carries the text that made it.
  const finishSubmission = async (
    voteSubmissionId: string,
    revised: boolean,
  ) => {
    await step.run('clear-ballot-draft', () =>
      deleteBallotDraft({ authUserId: account.authUserId, instanceId }),
    );
    await step.run('send-vote-event', () =>
      inngest.send({
        id: revised
          ? `vote-revised-${voteSubmissionId}-${messageSid}`
          : `vote-submitted-${voteSubmissionId}`,
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
      return deliverAll(
        deliver,
        revised ? 'send-ballot-updated' : 'send-ballot-submitted',
        revised ? 'Ballot updated reply' : 'Ballot submitted reply',
        [revised ? SMS_BALLOT_UPDATED_MESSAGE : SMS_BALLOT_SUBMITTED_MESSAGE],
        revised ? 'ballot revised' : 'ballot submitted',
      );
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
      return deliverAll(
        deliver,
        'send-ballot-already-in',
        'Ballot already in reply',
        [SMS_BALLOT_ALREADY_SUBMITTED_MESSAGE],
        'ballot already submitted',
      );
    }
    case 'empty':
      return deliverAll(
        deliver,
        'send-ballot-empty',
        'Ballot empty reply',
        [SMS_BALLOT_EMPTY_SUBMIT_MESSAGE],
        'ballot empty',
      );
    case 'unavailable':
      return deliverAll(
        deliver,
        'send-ballot-unavailable',
        'Ballot unavailable reply',
        [SMS_BALLOT_UNAVAILABLE_MESSAGE],
        'decision not found',
      );
    case 'not_enrolled': {
      const decision = await step.run('describe-ballot-decision', () =>
        describeEnrolmentDecision({ instanceId }),
      );
      return deliverAll(
        deliver,
        'send-register-first',
        'Register first reply',
        [
          formatSmsRegisterFirst(
            decision.name,
            line?.instanceId === instanceId ? null : decision.slug,
          ),
        ],
        'register first',
      );
    }
    case 'outside_district':
      return deliverAll(
        deliver,
        'send-ballot-outside-district',
        'Ballot outside district reply',
        ['A pick is outside your district. Text LIST, then REMOVE its code.'],
        'ballot outside district',
      );
    case 'not_allowed':
      return deliverAll(
        deliver,
        'send-change-not-allowed',
        'Change not allowed reply',
        [SMS_BALLOT_CHANGE_NOT_ALLOWED_MESSAGE],
        'change not allowed',
      );
    case 'refused':
      return deliverAll(
        deliver,
        'send-ballot-refused',
        'Ballot refused reply',
        [formatSmsBallotRefused(submission.reason)],
        'ballot refused',
      );
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
