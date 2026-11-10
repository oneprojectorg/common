import {
  type Geocode,
  BallotCostError,
  NotFoundError,
  SMS_BALLOT_OUTSIDE_SCOPE_MESSAGE,
  SMS_BALLOT_NEEDS_DECISION_MESSAGE,
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
  formatSmsBallotAlreadySubmitted,
  formatSmsBallotEmptySubmit,
  formatSmsBallotSubmitted,
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
  getSmsDecisionDescription,
  getSmsVotingDecision,
  listSmsBallotPage,
  setSessionPageCursor,
  listSmsDecisions,
  moveSmsBallotPick,
  removeSmsBallotPick,
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
  SMS_COMMAND_LIST_MESSAGE,
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
        ? 'No decision was found. Text SHOW to list your decisions.'
        : `No decision named "${clipSmsText(echoedSlug, SMS_SLUG_LENGTH)}" was found. Text SHOW to list your decisions.`,
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

export const infoHelp: SmsCommandHandler = async ({ deliver }) => {
  const failed = await deliver(
    'send-command-list',
    'Command list reply',
    SMS_COMMAND_LIST_MESSAGE,
  );
  return failed ?? { message: 'command list sent' };
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

const readDecision = (
  { step, account }: SmsCommandContext,
  decisionSlug: string,
) =>
  step.run('describe-decision', () =>
    swallowUnreadable(() =>
      getSmsDecisionDescription({
        authUserId: account.authUserId,
        decisionSlug,
      }),
    ),
  );

const sendDecisionInfo = async (
  deliver: SmsDeliver,
  decision: Parameters<typeof formatSmsDecisionInfo>[0],
): Promise<SmsCommandResult> => {
  const failed = await deliver(
    'send-decision-reply',
    'Decision reply',
    formatSmsDecisionInfo(decision),
  );
  return failed ?? { message: 'decision sent' };
};

const describeDecision = async (
  context: SmsCommandContext,
  decisionSlug: string,
  echoSlug: boolean,
): Promise<SmsCommandResult> => {
  const decision = await readDecision(context, decisionSlug);

  if (!decision) {
    return notFoundReply(context.deliver, echoSlug ? decisionSlug : null);
  }

  return sendDecisionInfo(context.deliver, decision);
};

export const show: SmsCommandHandler = async (context) => {
  if (context.argument) {
    return describeDecision(context, context.argument, true);
  }
  if (context.line?.slug) {
    const decision = await readDecision(context, context.line.slug);
    return decision
      ? sendDecisionInfo(context.deliver, decision)
      : listDecisions(context);
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

  const resolved = await step.run('resolve-vote-context', async () => {
    const decision = await swallowUnreadable(() =>
      getSmsVotingDecision({
        authUserId: account.authUserId,
        decisionSlug: slug,
      }),
    );
    if (!decision) {
      return { kind: 'not_found' as const };
    }
    if (!decision.votingOpen) {
      return { kind: 'closed' as const, name: decision.name };
    }
    const rule = decision.enrolment;
    if (!rule) {
      return {
        kind: 'no_enrolment' as const,
        name: decision.name,
        slug: decision.slug,
        instanceId: decision.instanceId,
      };
    }
    const key = {
      processInstanceId: decision.instanceId,
      authUserId: account.authUserId,
    };
    const pending = await findPendingVoterEnrolment(key);
    if (pending) {
      const waitingOn = await pendingEnrolmentStep({
        processInstanceId: decision.instanceId,
        taxonomyTermId: pending.taxonomyTermId,
        rule,
      });
      return waitingOn === 'awaiting_agree'
        ? {
            kind: 'pending_agree' as const,
            name: decision.name,
            termLabel: pending.termLabel,
            attestation: rule.attestation,
          }
        : { kind: 'pending_welcome' as const, name: decision.name };
    }
    const existing = await findVoterEnrolment(key);
    if (isVoterEnrolled(existing)) {
      return {
        kind: 'enrolled' as const,
        name: decision.name,
        slug: decision.slug,
        instanceId: decision.instanceId,
        budget: decision.budget,
      };
    }
    return {
      kind: 'start' as const,
      name: decision.name,
      instanceId: decision.instanceId,
      rule,
    };
  });

  const resendAttestation = (
    name: string,
    attestation: string,
    termLabel: string | null,
    message: string,
  ) =>
    deliverAll({
      deliver,
      stepId: 'send-attestation-again',
      label: 'Attestation reply',
      bodies: formatSmsAddressResolved({
        termLabel,
        decisionName: name,
        attestation,
      }),
      message,
    });

  const enrolmentWelcome = (name: string) =>
    deliverAll({
      deliver,
      stepId: 'send-enrolment-welcome',
      label: 'Registration welcome',
      bodies: formatSmsEnrolmentWelcome(name),
      message: 'enrolment started',
    });

  switch (resolved.kind) {
    case 'not_found':
      return notFoundReply(deliver, context.argument);
    case 'closed':
      return deliverAll({
        deliver,
        stepId: 'send-voting-closed',
        label: 'Voting closed reply',
        bodies: formatSmsVotingClosed(resolved.name),
        message: 'voting closed',
      });
    case 'no_enrolment':
      return deliverAll({
        deliver,
        stepId: 'send-no-enrolment-needed',
        label: 'No enrolment needed reply',
        bodies: formatSmsNoEnrolmentNeeded(
          resolved.name,
          context.line?.instanceId === resolved.instanceId
            ? null
            : resolved.slug,
        ),
        message: 'no enrolment needed',
      });
    case 'pending_agree':
      return resendAttestation(
        resolved.name,
        resolved.attestation,
        resolved.termLabel,
        'attestation resent',
      );
    case 'pending_welcome':
      return enrolmentWelcome(resolved.name);
    case 'enrolled':
      return deliverAll({
        deliver,
        stepId: 'send-already-enrolled',
        label: 'Already registered reply',
        bodies: formatSmsEnrolled({
          decisionName: resolved.name,
          termLabel: null,
          budget: resolved.budget,
          slug:
            context.line?.instanceId === resolved.instanceId
              ? null
              : resolved.slug,
        }),
        message: 'already enrolled',
      });
    case 'start':
      break;
  }

  const { rule, instanceId, name } = resolved;
  const { waitingOn } = await step.run('start-enrolment', async () => {
    const started = await startVoterEnrolment({
      processInstanceId: instanceId,
      authUserId: account.authUserId,
    });
    return {
      waitingOn: await pendingEnrolmentStep({
        processInstanceId: instanceId,
        taxonomyTermId: started.taxonomyTermId,
        rule,
      }),
    };
  });

  if (waitingOn === 'awaiting_agree') {
    return resendAttestation(name, rule.attestation, null, 'attestation sent');
  }

  return enrolmentWelcome(name);
};

export const agree: SmsCommandHandler = async (context) => {
  const { step, account, deliver, line } = context;
  const nothingToAffirm = () =>
    deliverAll({
      deliver,
      stepId: 'send-nothing-to-affirm',
      label: 'Nothing to affirm reply',
      bodies: formatSmsNothingToAffirm(),
      message: 'nothing to affirm',
    });

  const resolved = await step.run('resolve-agree-context', async () => {
    const pending = await findPendingVoterEnrolment({
      authUserId: account.authUserId,
    });
    if (!pending) {
      return { kind: 'nothing' as const };
    }
    const decision = await swallowUnreadable(() =>
      describeEnrolmentDecision({
        instanceId: pending.processInstanceId,
        authUserId: account.authUserId,
      }),
    );
    const rule = decision?.enrolment;
    if (!decision || !rule || !decision.votingOpen) {
      return { kind: 'nothing' as const };
    }
    const waitingOn = await pendingEnrolmentStep({
      processInstanceId: pending.processInstanceId,
      taxonomyTermId: pending.taxonomyTermId,
      rule,
    });
    if (waitingOn !== 'awaiting_agree') {
      return { kind: 'nothing' as const };
    }
    return {
      kind: 'affirm' as const,
      instanceId: pending.processInstanceId,
      termLabel: pending.termLabel,
      name: decision.name,
      slug: decision.slug,
      budget: decision.budget,
    };
  });

  if (resolved.kind === 'nothing') {
    return nothingToAffirm();
  }

  await step.run('affirm-attestation', () =>
    affirmVoterAttestation({
      processInstanceId: resolved.instanceId,
      authUserId: account.authUserId,
    }),
  );

  return deliverAll({
    deliver,
    stepId: 'send-enrolled',
    label: 'Registered reply',
    bodies: formatSmsEnrolled({
      decisionName: resolved.name,
      termLabel: resolved.termLabel,
      budget: resolved.budget,
      slug: line?.instanceId === resolved.instanceId ? null : resolved.slug,
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

  const codes = parseProposalCodes(address);

  const codesOrHelp = () =>
    codes ? pickByCodes(context, codes) : sendSmsHelp(deliver);

  const resolved = await step.run('resolve-free-text-context', async () => {
    const pending = await findPendingVoterEnrolment({
      authUserId: account.authUserId,
    });
    const pendingElsewhere =
      line !== null &&
      pending !== null &&
      pending.processInstanceId !== line.instanceId;
    if (!pending || (codes && pendingElsewhere)) {
      return { kind: 'codes_or_help' as const };
    }
    const decision = await swallowUnreadable(() =>
      describeEnrolmentDecision({
        instanceId: pending.processInstanceId,
        authUserId: account.authUserId,
      }),
    );
    const rule = decision?.enrolment;
    if (!decision || !rule || !decision.votingOpen) {
      return { kind: 'help' as const };
    }
    const waitingOn = await pendingEnrolmentStep({
      processInstanceId: pending.processInstanceId,
      taxonomyTermId: pending.taxonomyTermId,
      rule,
    });
    if (waitingOn !== 'awaiting_address') {
      return { kind: 'codes_or_help' as const };
    }
    return {
      kind: 'awaiting_address' as const,
      instanceId: pending.processInstanceId,
      name: decision.name,
      attestation: rule.attestation,
    };
  });

  if (resolved.kind === 'codes_or_help') {
    return codesOrHelp();
  }
  if (resolved.kind === 'help') {
    return sendSmsHelp(deliver);
  }

  const resolution = await step.run('resolve-address', () =>
    resolveVoterAddress({
      processInstanceId: resolved.instanceId,
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
        bodies: formatSmsAddressOutside(resolved.name),
        message: 'address outside',
      });
    case 'resolved':
      return deliverAll({
        deliver,
        stepId: 'send-attestation',
        label: 'Attestation reply',
        bodies: formatSmsAddressResolved({
          termLabel: resolution.boundary?.name ?? null,
          decisionName: resolved.name,
          attestation: resolved.attestation,
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

  const resolved = await step.run('resolve-ballot-page', async () => {
    const decision = await swallowUnreadable(() =>
      getSmsVotingDecision({
        authUserId: account.authUserId,
        decisionSlug: slug,
      }),
    );
    if (!decision) {
      return { kind: 'not_found' as const };
    }
    if (!decision.votingOpen) {
      return { kind: 'closed' as const, name: decision.name };
    }
    if (decision.enrolment) {
      const enrolment = await findVoterEnrolment({
        processInstanceId: decision.instanceId,
        authUserId: account.authUserId,
      });
      if (!isVoterEnrolled(enrolment)) {
        return { kind: 'register_first' as const, name: decision.name };
      }
    }
    const page = await readBallot({
      authUserId: account.authUserId,
      instanceId: decision.instanceId,
      decision: { name: decision.name, slug: decision.slug },
      fn: () =>
        listSmsBallotPage({
          authUserId: account.authUserId,
          instanceId: decision.instanceId,
          phoneNumberId: context.line?.id,
        }),
    });
    return { kind: 'page' as const, instanceId: decision.instanceId, page };
  });

  switch (resolved.kind) {
    case 'not_found':
      return notFoundReply(deliver, slug);
    case 'closed':
      return deliverAll({
        deliver,
        stepId: 'send-voting-closed',
        label: 'Voting closed reply',
        bodies: formatSmsVotingClosed(resolved.name),
        message: 'voting closed',
      });
    case 'register_first':
      return deliverAll({
        deliver,
        stepId: 'send-register-first',
        label: 'Register first reply',
        bodies: [formatSmsRegisterFirst(resolved.name, context.argument)],
        message: 'register first',
      });
    case 'page':
      return resolved.page.ok
        ? deliverBallotPage(
            context,
            resolved.page.value,
            'first',
            resolved.instanceId,
          )
        : refuseBallotRead(context, resolved.page, resolved.instanceId);
  }
};

type RefusalDecision = { name: string; slug: string } | null;

type BallotRefusal =
  | { reason: 'unavailable' }
  | { reason: 'unpriced'; message: string }
  | { reason: 'not_enrolled' | 'closed'; decision: RefusalDecision };

type BallotRead<T> = { ok: true; value: T } | ({ ok: false } & BallotRefusal);

const readBallot = async <T>({
  authUserId,
  instanceId,
  decision,
  fn,
}: {
  authUserId: string;
  instanceId: string;
  decision?: RefusalDecision;
  fn: () => Promise<T>;
}): Promise<BallotRead<T>> => {
  const lookupDecision = async (): Promise<RefusalDecision> => {
    const described = await swallowUnreadable(() =>
      describeEnrolmentDecision({ instanceId, authUserId }),
    );
    return described ? { name: described.name, slug: described.slug } : null;
  };
  const classify = async (
    reason: 'not_enrolled' | 'closed',
  ): Promise<BallotRead<T>> => ({
    ok: false,
    reason,
    decision: decision !== undefined ? decision : await lookupDecision(),
  });
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    if (error instanceof VoterNotEnrolledError) {
      return classify('not_enrolled');
    }
    if (error instanceof NotFoundError || error instanceof UnauthorizedError) {
      return { ok: false, reason: 'unavailable' };
    }
    if (error instanceof BallotCostError) {
      return { ok: false, reason: 'unpriced', message: error.message };
    }
    if (error instanceof ValidationError) {
      return classify('closed');
    }
    throw error;
  }
};

const refuseBallotRead = (
  { deliver, line }: SmsCommandContext,
  refusal: BallotRefusal,
  instanceId: string,
): Promise<SmsCommandResult> => {
  if (refusal.reason === 'unpriced') {
    return deliverAll({
      deliver,
      stepId: 'send-ballot-unpriced',
      label: 'Ballot unpriced reply',
      bodies: [refusal.message],
      message: 'ballot unpriced',
    });
  }
  if (refusal.reason === 'unavailable' || !refusal.decision) {
    return deliverAll({
      deliver,
      stepId: 'send-ballot-unavailable',
      label: 'Ballot unavailable reply',
      bodies: [SMS_BALLOT_UNAVAILABLE_MESSAGE],
      message: 'decision not found',
    });
  }
  const { decision } = refusal;
  return refusal.reason === 'closed'
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

const findBrowseInstance = async ({
  account,
  line,
}: Pick<SmsCommandContext, 'account' | 'line'>): Promise<string | null> => {
  const session = await findLatestChatSession({
    authUserId: account.authUserId,
    ...(line ? { phoneNumberId: line.id } : {}),
  });
  return session?.processInstanceId ?? line?.instanceId ?? null;
};

export const more: SmsCommandHandler = async (context) => {
  const { step, account, deliver } = context;

  const resolved = await step.run('resolve-next-ballot-page', async () => {
    const instanceId = await findBrowseInstance(context);
    const session = instanceId
      ? await findChatSession({
          processInstanceId: instanceId,
          authUserId: account.authUserId,
        })
      : null;
    if (!session || session.pageCursor === null) {
      return { kind: 'not_started' as const };
    }
    const after = session.pageCursor;
    const page = await readBallot({
      authUserId: account.authUserId,
      instanceId: session.processInstanceId,
      fn: () =>
        listSmsBallotPage({
          authUserId: account.authUserId,
          instanceId: session.processInstanceId,
          after,
        }),
    });
    return {
      kind: 'page' as const,
      instanceId: session.processInstanceId,
      page,
    };
  });

  if (resolved.kind === 'not_started') {
    return deliverAll({
      deliver,
      stepId: 'send-browse-start',
      label: 'Browse start reply',
      bodies: [SMS_BROWSE_START_MESSAGE],
      message: 'browse not started',
    });
  }

  return resolved.page.ok
    ? deliverBallotPage(
        context,
        resolved.page.value,
        'next',
        resolved.instanceId,
      )
    : refuseBallotRead(context, resolved.page, resolved.instanceId);
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

  const resolved = await step.run('resolve-proposal-info', async () => {
    const instanceId = await findBrowseInstance(context);
    if (!instanceId) {
      return { kind: 'needs_decision' as const };
    }
    const read = await readBallot({
      authUserId: account.authUserId,
      instanceId,
      fn: () =>
        getSmsBallotProposal({
          authUserId: account.authUserId,
          instanceId,
          code,
        }),
    });
    if (!read.ok) {
      return { kind: 'refused' as const, instanceId, read };
    }
    if (!read.value) {
      const slug = await findBrowseSlugHint(context, instanceId);
      return { kind: 'miss' as const, slug };
    }
    return { kind: 'proposal' as const, proposal: read.value };
  });

  switch (resolved.kind) {
    case 'needs_decision':
      return deliverAll({
        deliver,
        stepId: 'send-info-needs-decision',
        label: 'Info needs a decision',
        bodies: [SMS_INFO_NEEDS_DECISION_MESSAGE],
        message: 'info needs a decision',
      });
    case 'refused':
      return refuseBallotRead(context, resolved.read, resolved.instanceId);
    case 'miss':
      return deliverAll({
        deliver,
        stepId: 'send-proposal-not-on-ballot',
        label: 'Proposal not on ballot reply',
        bodies: [formatSmsProposalNotOnBallot(code, resolved.slug)],
        message: 'proposal not on ballot',
      });
    case 'proposal':
      return deliverAll({
        deliver,
        stepId: 'send-proposal-info',
        label: 'Proposal info',
        bodies: formatSmsProposalInfo(resolved.proposal),
        message: 'proposal info sent',
      });
  }
};

const findBrowseSlugHint = async (
  { account, line }: Pick<SmsCommandContext, 'account' | 'line'>,
  instanceId: string,
): Promise<string | null> => {
  if (line?.instanceId === instanceId) {
    return null;
  }
  const decision = await swallowUnreadable(() =>
    describeEnrolmentDecision({ instanceId, authUserId: account.authUserId }),
  );
  return decision?.slug ?? null;
};

const browseSlugHint = (
  context: SmsCommandContext,
  instanceId: string,
  stepTag: string,
): Promise<string | null> =>
  context.line?.instanceId === instanceId
    ? Promise.resolve(null)
    : context.step.run(`describe-${stepTag}-hint-decision`, () =>
        findBrowseSlugHint(context, instanceId),
      );

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
// shared number, so a second SUBMIT finds it after the draft is gone.
const findBallotInstance = async ({
  account,
  line,
}: Pick<SmsCommandContext, 'account' | 'line'>): Promise<string | null> => {
  const fromBrowse = await findBrowseInstance({ account, line });
  if (fromBrowse || line) {
    return fromBrowse;
  }
  return findLatestCastBallotInstance({ authUserId: account.authUserId });
};

type BallotTarget =
  | { kind: 'needs_decision' }
  | { kind: 'cast'; instanceId: string }
  | { kind: 'ready'; instanceId: string };

const findBallotTarget = async (
  context: Pick<SmsCommandContext, 'account' | 'line'>,
): Promise<BallotTarget> => {
  const instanceId = await findBallotInstance(context);
  if (!instanceId) {
    return { kind: 'needs_decision' };
  }
  const castId = await findCastBallot({
    authUserId: context.account.authUserId,
    instanceId,
  });
  return castId ? { kind: 'cast', instanceId } : { kind: 'ready', instanceId };
};

const sendBallotCastGuard = (
  { deliver, line }: SmsCommandContext,
  instanceId: string,
): Promise<SmsCommandResult> =>
  deliverAll({
    deliver,
    stepId: 'send-ballot-cast-guard',
    label: 'Ballot already in reply',
    bodies: [formatSmsBallotAlreadySubmitted(line?.instanceId === instanceId)],
    message: 'ballot already submitted',
  });

const sendBallotNeedsDecision = (deliver: SmsDeliver) =>
  deliverAll({
    deliver,
    stepId: 'send-ballot-needs-decision',
    label: 'Ballot needs a decision',
    bodies: [SMS_BALLOT_NEEDS_DECISION_MESSAGE],
    message: 'ballot needs a decision',
  });

const resolveBallotTarget = (
  context: SmsCommandContext,
): Promise<BallotTarget> =>
  context.step.run('resolve-ballot-target', () => findBallotTarget(context));

const pickByCodes = async (
  context: SmsCommandContext,
  codes: number[],
): Promise<SmsCommandResult> => {
  const { step, account, deliver, line } = context;

  const resolved = await step.run('resolve-pick-context', async () => {
    const target = await findBallotTarget(context);
    if (target.kind !== 'ready') {
      return target;
    }
    const { instanceId } = target;
    const decision = await swallowUnreadable(() =>
      describeEnrolmentDecision({
        instanceId,
        authUserId: account.authUserId,
      }),
    );
    if (!decision) {
      return { kind: 'unavailable' as const };
    }
    if (!decision.votingOpen) {
      return { kind: 'closed' as const, name: decision.name };
    }
    if (decision.enrolment) {
      const enrolment = await findVoterEnrolment({
        processInstanceId: instanceId,
        authUserId: account.authUserId,
      });
      if (!isVoterEnrolled(enrolment)) {
        return {
          kind: 'register_first' as const,
          instanceId,
          name: decision.name,
          slug: decision.slug,
        };
      }
    }
    return target;
  });

  switch (resolved.kind) {
    case 'needs_decision':
      return sendBallotNeedsDecision(deliver);
    case 'cast':
      return sendBallotCastGuard(context, resolved.instanceId);
    case 'unavailable':
      return deliverAll({
        deliver,
        stepId: 'send-ballot-unavailable',
        label: 'Ballot unavailable reply',
        bodies: [SMS_BALLOT_UNAVAILABLE_MESSAGE],
        message: 'decision not found',
      });
    case 'closed':
      return deliverAll({
        deliver,
        stepId: 'send-voting-closed',
        label: 'Voting closed reply',
        bodies: formatSmsVotingClosed(resolved.name),
        message: 'voting closed',
      });
    case 'register_first':
      return deliverAll({
        deliver,
        stepId: 'send-register-first',
        label: 'Register first reply',
        bodies: [
          formatSmsRegisterFirst(
            resolved.name,
            line?.instanceId === resolved.instanceId ? null : resolved.slug,
          ),
        ],
        message: 'register first',
      });
    case 'ready':
      break;
  }

  const { instanceId } = resolved;

  const picked = await step.run('add-ballot-picks', () =>
    readBallot({
      authUserId: account.authUserId,
      instanceId,
      fn: () =>
        addSmsBallotPicks({
          authUserId: account.authUserId,
          instanceId,
          codes,
          phoneNumberId: context.line?.id,
        }),
    }),
  );

  if (!picked.ok) {
    return refuseBallotRead(context, picked, instanceId);
  }

  const { results, summary, hadPicks } = picked.value;
  const unknownSlug = results.some((r) => r.status === 'unknown')
    ? await browseSlugHint(context, instanceId, 'unknown-code')
    : null;
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
          return formatSmsProposalNotOnBallot(r.code, unknownSlug);
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

  const resolved = await step.run('resolve-ballot-summary', async () => {
    const target = await findBallotTarget(context);
    if (target.kind !== 'ready') {
      return target;
    }
    const { instanceId } = target;
    const read = await readBallot({
      authUserId: account.authUserId,
      instanceId,
      fn: () =>
        summarizeSmsBallot({ authUserId: account.authUserId, instanceId }),
    });
    return { kind: 'summary' as const, instanceId, read };
  });

  if (resolved.kind === 'needs_decision') {
    return sendBallotNeedsDecision(deliver);
  }
  if (resolved.kind === 'cast') {
    return sendBallotCastGuard(context, resolved.instanceId);
  }

  if (!resolved.read.ok) {
    return refuseBallotRead(context, resolved.read, resolved.instanceId);
  }

  const summary = resolved.read.value;

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

  const target = await resolveBallotTarget(context);
  if (target.kind === 'needs_decision') {
    return sendBallotNeedsDecision(deliver);
  }
  if (target.kind === 'cast') {
    return sendBallotCastGuard(context, target.instanceId);
  }
  const { instanceId } = target;

  const removed = await step.run('remove-ballot-pick', () =>
    readBallot({
      authUserId: account.authUserId,
      instanceId,
      fn: () =>
        removeSmsBallotPick({
          authUserId: account.authUserId,
          instanceId,
          code,
        }),
    }),
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

  const target = await resolveBallotTarget(context);
  if (target.kind === 'needs_decision') {
    return sendBallotNeedsDecision(deliver);
  }
  if (target.kind === 'cast') {
    return sendBallotCastGuard(context, target.instanceId);
  }
  const { instanceId } = target;

  const moved = await step.run('move-ballot-pick', () =>
    readBallot({
      authUserId: account.authUserId,
      instanceId,
      fn: () =>
        moveSmsBallotPick({
          authUserId: account.authUserId,
          instanceId,
          code,
          position,
        }),
    }),
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
  const instanceId = await step.run('resolve-ballot-instance', () =>
    findBallotInstance(context),
  );

  if (!instanceId) {
    return sendBallotNeedsDecision(deliver);
  }

  const submission = await step.run('submit-ballot', () =>
    submitSmsBallot({ authUserId: account.authUserId, instanceId }),
  );

  // The follow-ups run on a retry too: a run that stopped after submitVote
  // committed comes back as already_submitted with the same submission id, and
  // the event id keeps Inngest from firing twice for one ballot.
  const finishSubmission = async (voteSubmissionId: string) => {
    await step.run('send-vote-submitted', () =>
      inngest.send({
        id: `vote-submitted-${voteSubmissionId}`,
        name: Events.voteSubmitted.name,
        data: { voteSubmissionId, processInstanceId: instanceId },
      }),
    );
    await step.run('clear-ballot-draft', () =>
      deleteBallotDraft({ authUserId: account.authUserId, instanceId }),
    );
  };

  switch (submission.status) {
    case 'submitted':
      await finishSubmission(submission.voteSubmissionId);
      return deliverAll({
        deliver,
        stepId: 'send-ballot-submitted',
        label: 'Ballot submitted reply',
        bodies: [formatSmsBallotSubmitted(line?.instanceId === instanceId)],
        message: 'ballot submitted',
      });
    case 'already_submitted': {
      const draft = await step.run('find-stale-draft', () =>
        findBallotDraft({
          processInstanceId: instanceId,
          authUserId: account.authUserId,
        }),
      );
      if (draft) {
        await finishSubmission(submission.voteSubmissionId);
      }
      return deliverAll({
        deliver,
        stepId: 'send-ballot-already-in',
        label: 'Ballot already in reply',
        bodies: [
          formatSmsBallotAlreadySubmitted(line?.instanceId === instanceId),
        ],
        message: 'ballot already submitted',
      });
    }
    case 'empty':
      return deliverAll({
        deliver,
        stepId: 'send-ballot-empty',
        label: 'Ballot empty reply',
        bodies: [
          formatSmsBallotEmptySubmit(
            await browseSlugHint(context, instanceId, 'empty-ballot'),
          ),
        ],
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
