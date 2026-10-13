import {
  type DecisionInstanceData,
  type SmsBallotProposal,
  type SmsFailureReason,
  RateLimitError,
  SMS_BALLOT_SUBMITTED,
  SMS_PROPOSALS_PAGE_SIZE,
  UnauthorizedError,
  ValidationError,
  assertVoteAccess,
  formatSmsBallot,
  formatSmsBallotWelcome,
  formatSmsOverLimit,
  formatSmsPickConfirmation,
  formatSmsPicksLeft,
  formatSmsProposalInfo,
  formatSmsProposalPage,
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

        const instanceData = instance.instanceData as DecisionInstanceData;
        const phase = instanceData?.phases?.find(
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
      return { message: 'no ballot available' };
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
      return { message: 'not allowed to vote' };
    }

    const provider = getSmsProvider();

    if (!provider?.sendSms) {
      logger.error(
        'Cannot send an SMS ballot: no Twilio Messaging Service configured',
        { processInstanceId },
      );
      return { message: 'sms sending unavailable' };
    }

    const sendSms = provider.sendSms;
    const to = parsePhoneNumber(phone);
    const { decisionName, maxVotesPerMember, proposals } = context;

    const picks: SmsBallotProposal[] = [];
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
      return { message: 'send rejected', reason, picks: picks.length };
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
    let page = 0;
    let paging: 'ballot' | 'command' | null = null;

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
          if (
            error instanceof ValidationError ||
            error instanceof UnauthorizedError
          ) {
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
        return { message: 'ballot rejected', reason: outcome.reason };
      }

      await text('send-ballot-submitted', SMS_BALLOT_SUBMITTED);
      logger.info('Recorded a ballot from SMS', {
        processInstanceId,
        authUserId,
        picks: picks.length,
      });
      return {
        message: 'ballot submitted',
        voteSubmissionId: outcome.voteSubmissionId,
      };
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
        await text(
          'send-ballot-expired',
          `Your ballot for "${decisionName}" was not submitted.${context.slug ? ` Text VOTE ${context.slug} to start again.` : ''}`,
        );
        return { message: 'ballot expired', picks: picks.length };
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
        case 'submit':
          if (picks.length === 0) {
            await say(formatSmsBallot({ decisionName, picks }));
            continue;
          }
          return submitBallot();
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
        case 'proposals':
          if (argument !== null) {
            paging = 'command';
            continue;
          }
          page = 0;
          paging = 'ballot';
          await say(
            formatSmsProposalPage({ decisionName, proposals, page }).body,
          );
          continue;
        case 'more': {
          if (paging === 'command') {
            continue;
          }
          if (paging === null) {
            await say(GUIDANCE);
            continue;
          }
          const nextPage = page + 1;
          if (nextPage * SMS_PROPOSALS_PAGE_SIZE < proposals.length) {
            page = nextPage;
          }
          await say(
            formatSmsProposalPage({ decisionName, proposals, page }).body,
          );
          continue;
        }
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
    });
    return { message: 'ballot abandoned', picks: picks.length };
  },
);
