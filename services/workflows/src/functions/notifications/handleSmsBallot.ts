import {
  type SmsBallotProposal,
  type SmsFailureReason,
  CommonError,
  RateLimitError,
  SMS_BALLOT_SUBMITTED,
  SMS_PROPOSALS_PAGE_SIZE,
  UnauthorizedError,
  assertVoteAccess,
  formatSmsBallot,
  formatSmsBallotWelcome,
  formatSmsOverLimit,
  formatSmsPickConfirmation,
  formatSmsPicksLeft,
  formatSmsProposalInfo,
  formatSmsProposalPage,
  getInstancePhases,
  getSmsProvider,
  getSmsVotability,
  listSmsBallotProposals,
  parsePhoneNumber,
  submitVote,
} from '@op/common';
import { db } from '@op/db/client';
import { processInstances, profiles } from '@op/db/schema';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';
import { eq } from 'drizzle-orm';

import { smsNumberRateLimit } from './smsInboundLimits';

const BALLOT_WINDOW_MS = 24 * 60 * 60_000;
const MAX_TURNS = 40;
const CODE_PATTERN = /^\d{3}$/;
const GUIDANCE =
  'Text a proposal code to add a pick, LIST to see your ballot, or DONE to review.';
const { voteSmsBallotRequested, smsInboundReceived } = Events;

interface BallotContext {
  profileId: string;
  decisionName: string;
  slug: string | null;
  votingOpen: boolean;
  maxVotesPerMember: number | null;
  proposals: SmsBallotProposal[];
}

export const handleSmsBallot = inngest.createFunction(
  {
    id: 'handleSmsBallot',
    rateLimit: smsNumberRateLimit('event.data.phone'),
    singleton: {
      key: 'event.data.phone',
      mode: 'skip',
    },
  },
  { event: voteSmsBallotRequested.name },
  async ({ event, step }) => {
    const { processInstanceId, authUserId, phone } =
      voteSmsBallotRequested.schema.parse(event.data);
    const picks: SmsBallotProposal[] = [];

    const end = <T extends { message: string }>(result: T): T => {
      logger.event('sms.ballot.ended', {
        outcome: result.message,
        processInstanceId,
        authUserId,
        picks: picks.length,
      });
      return result;
    };

    const context = await step.run(
      'load-ballot',
      async (): Promise<BallotContext | null> => {
        const [instance] = await db
          .select({
            profileId: processInstances.profileId,
            instanceData: processInstances.instanceData,
            currentStateId: processInstances.currentStateId,
            name: profiles.name,
            slug: profiles.slug,
          })
          .from(processInstances)
          .leftJoin(profiles, eq(processInstances.profileId, profiles.id))
          .where(eq(processInstances.id, processInstanceId))
          .limit(1);

        if (!instance?.profileId) {
          return null;
        }

        const phase = getInstancePhases(instance.instanceData).find(
          (candidate) => candidate.phaseId === instance.currentStateId,
        );
        const votability = await getSmsVotability({ processInstanceId, phase });
        const proposals = await listSmsBallotProposals({ processInstanceId });

        return {
          profileId: instance.profileId,
          decisionName: instance.name ?? '',
          slug: instance.slug ?? null,
          votingOpen: votability.votingOpen,
          maxVotesPerMember: votability.maxVotesPerMember,
          proposals,
        };
      },
    );

    if (!context || !context.votingOpen || context.proposals.length === 0) {
      logger.info('No SMS ballot available for this decision', {
        processInstanceId,
        authUserId,
      });
      return end({ message: 'no ballot available' });
    }

    const canVote = await step.run('check-vote-access', async () => {
      try {
        await assertVoteAccess({ authUserId, profileId: context.profileId });
        return true;
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          return false;
        }
        throw error;
      }
    });

    if (!canVote) {
      logger.info('SMS ballot refused: the account cannot vote', {
        processInstanceId,
        authUserId,
      });
      return end({ message: 'not allowed to vote' });
    }

    const provider = getSmsProvider();

    if (!provider?.sendSms) {
      logger.error(
        'Cannot send an SMS ballot: no Twilio Messaging Service configured',
        { processInstanceId },
      );
      return end({ message: 'sms sending unavailable' });
    }

    const sendSms = provider.sendSms;
    const to = parsePhoneNumber(phone);
    const { decisionName, maxVotesPerMember, proposals } = context;

    let stopped: SmsFailureReason | null = null;

    const text = async (stepId: string, body: string) => {
      const result = await step.run(stepId, async () => {
        const sent = await sendSms({ to, body });
        if (sent.status === 'rejected' && sent.retryable) {
          throw new RateLimitError(`Ballot text rejected: ${sent.reason}`);
        }
        return sent;
      });
      if (result.status === 'rejected') {
        stopped = result.reason;
      }
      return result;
    };

    const stop = (reason: SmsFailureReason) => {
      logger.warn('Ballot text permanently rejected, ending the ballot', {
        processInstanceId,
        authUserId,
        reason,
        picks: picks.length,
      });
      return end({ message: 'send rejected', reason, picks: picks.length });
    };

    await text(
      'send-welcome',
      formatSmsBallotWelcome({ decisionName, proposals, maxVotesPerMember }),
    );

    if (stopped) {
      return stop(stopped);
    }

    const deadline = await step.run(
      'start-ballot-window',
      () => Date.now() + BALLOT_WINDOW_MS,
    );

    const byCode = new Map(
      proposals.map((proposal) => [proposal.code, proposal]),
    );
    const submitBallot = async () => {
      const outcome = await step.run('submit-ballot', async () => {
        try {
          const submission = await submitVote({
            data: {
              processInstanceId,
              selectedProposalIds: picks.map((pick) => pick.proposalId),
              authUserId,
            },
            authUserId,
          });
          return {
            status: 'recorded' as const,
            voteSubmissionId: submission.id,
          };
        } catch (error) {
          if (error instanceof CommonError) {
            return { status: 'rejected' as const, reason: error.message };
          }
          throw error;
        }
      });

      if (outcome.status === 'rejected') {
        logger.warn('SMS ballot was not recorded', {
          processInstanceId,
          authUserId,
          reason: outcome.reason,
        });
        await text(
          'send-ballot-rejected',
          `We could not record your ballot for "${decisionName}".`,
        );
        return end({ message: 'ballot rejected', reason: outcome.reason });
      }

      await text('send-ballot-submitted', SMS_BALLOT_SUBMITTED);
      logger.info('Recorded a ballot from SMS', {
        processInstanceId,
        authUserId,
        picks: picks.length,
      });
      return end({
        message: 'ballot submitted',
        voteSubmissionId: outcome.voteSubmissionId,
      });
    };

    const addPicks = (codes: ReadonlyArray<string>): string => {
      const added: Array<{ rank: number; proposal: SmsBallotProposal }> = [];
      const notes: string[] = [];

      for (const code of codes) {
        const proposal = byCode.get(code);
        if (!proposal) {
          notes.push(`No proposal with code ${code}.`);
          continue;
        }
        if (picks.some((pick) => pick.code === code)) {
          notes.push(`"${proposal.title}" is already on your ballot.`);
          continue;
        }
        if (maxVotesPerMember !== null && picks.length >= maxVotesPerMember) {
          notes.push(formatSmsOverLimit(maxVotesPerMember));
          break;
        }
        picks.push(proposal);
        added.push({ rank: picks.length, proposal });
      }

      const confirmation =
        added.length > 0
          ? formatSmsPickConfirmation({
              added,
              pickCount: picks.length,
              maxVotesPerMember,
            })
          : null;

      return [...notes, confirmation ?? (notes.length > 0 ? '' : GUIDANCE)]
        .filter(Boolean)
        .join(' ');
    };

    const expire = async (message: 'ballot expired' | 'ballot abandoned') => {
      await text(
        'send-ballot-expired',
        `Your ballot for "${decisionName}" was not submitted.${context.slug ? ` Text VOTE ${context.slug} to start again.` : ''}`,
      );
      return end({ message, picks: picks.length });
    };

    for (let turn = 1; turn <= MAX_TURNS; turn++) {
      if (stopped) {
        return stop(stopped);
      }
      const reply = await step.waitForEvent(`wait-for-reply-${turn}`, {
        event: smsInboundReceived.name,
        if: 'event.data.phone == async.data.from',
        timeout: new Date(deadline),
      });

      if (!reply) {
        logger.info('SMS ballot window closed without a submission', {
          processInstanceId,
          authUserId,
          picks: picks.length,
        });
        return expire('ballot expired');
      }

      const { keyword, argument, codes } = smsInboundReceived.schema.parse(
        reply.data,
      );
      const say = (body: string) => text(`reply-${turn}`, body);

      if (codes.length > 0) {
        await say(addPicks(codes));
        continue;
      }

      switch (keyword) {
        case 'yes': {
          const only = proposals.length === 1 ? proposals[0] : undefined;
          if (only && picks.length === 0) {
            picks.push(only);
            return submitBallot();
          }
          await say(GUIDANCE);
          continue;
        }
        case 'list':
        case 'done':
          await say(formatSmsBallot({ decisionName, picks }));
          continue;
        case 'submit': {
          if (picks.length === 0) {
            await say(formatSmsBallot({ decisionName, picks }));
            continue;
          }
          const onBallot = await step.run(`check-picks-${turn}`, async () => {
            const current = await listSmsBallotProposals({ processInstanceId });
            return current.map((proposal) => proposal.proposalId);
          });
          const dropped = picks.filter(
            (pick) => !onBallot.includes(pick.proposalId),
          );
          if (dropped.length > 0) {
            picks.splice(
              0,
              picks.length,
              ...picks.filter((pick) => onBallot.includes(pick.proposalId)),
            );
            await say(
              [
                ...dropped.map(
                  (pick) =>
                    `"${pick.title}" is no longer on the ballot and was removed.`,
                ),
                picks.length === 0
                  ? formatSmsBallot({ decisionName, picks })
                  : [
                      formatSmsPicksLeft(picks.length, maxVotesPerMember),
                      'Reply SUBMIT to cast your ballot, or REMOVE plus a code to change it.',
                    ]
                      .filter(Boolean)
                      .join(' '),
              ].join(' '),
            );
            continue;
          }
          return submitBallot();
        }
        case 'remove': {
          const index = picks.findIndex((pick) => pick.code === argument);
          if (index === -1) {
            await say(
              `No pick with code ${argument ?? '?'} on your ballot. LIST shows your ballot.`,
            );
            continue;
          }
          const [removed] = picks.splice(index, 1);
          await say(
            [
              `Removed "${removed?.title ?? ''}".`,
              formatSmsPicksLeft(picks.length, maxVotesPerMember),
              'LIST shows your ballot.',
            ]
              .filter(Boolean)
              .join(' '),
          );
          continue;
        }
        case 'proposals': {
          if (argument !== null) {
            continue;
          }
          const pageCount = Math.ceil(
            proposals.length / SMS_PROPOSALS_PAGE_SIZE,
          );
          for (let page = 0; page < pageCount; page++) {
            await text(
              `reply-${turn}-page-${page + 1}`,
              formatSmsProposalPage({ decisionName, proposals, page }).body,
            );
          }
          continue;
        }
        case 'more':
          await say(GUIDANCE);
          continue;
        case 'info': {
          if (argument === null || !CODE_PATTERN.test(argument)) {
            continue;
          }
          const proposal = byCode.get(argument);
          await say(
            proposal
              ? formatSmsProposalInfo(proposal)
              : `No proposal with code ${argument}. Text PROPOSALS to browse.`,
          );
          continue;
        }
        case 'vote':
        case 'show':
        case 'decisions':
        case 'join':
          continue;
        default:
          await say(GUIDANCE);
      }
    }

    logger.info('SMS ballot reached its turn limit without a submission', {
      processInstanceId,
      authUserId,
      picks: picks.length,
    });
    return expire('ballot abandoned');
  },
);
