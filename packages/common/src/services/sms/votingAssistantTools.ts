import { createTool } from '@op/ai';
import { z } from 'zod';

import { describeEnrolmentDecision } from '../decision/sms/getSmsVotingDecision';
import {
  addSmsBallotPicks,
  findCastBallot,
  moveSmsBallotPick,
  removeSmsBallotPick,
  submitSmsBallot,
  summarizeSmsBallot,
} from '../decision/sms/smsBallot';
import {
  getSmsBallotProposal,
  listSmsBallotPage,
} from '../decision/sms/smsBallotBrowse';
import {
  findPendingVoterEnrolment,
  findVoterEnrolment,
  isVoterEnrolled,
  pendingEnrolmentStep,
} from '../decision/voterEnrolment';

export interface VotingAssistantIdentity {
  authUserId: string;
  instanceId: string | null;
}

const NO_DECISION = {
  error:
    'No decision is linked to this conversation. The member can text SHOW to list their decisions.',
} as const;

const failure = (error: unknown) => ({
  error: error instanceof Error ? error.message : 'The request was refused.',
});

export const votingAssistantTools = ({
  authUserId,
  instanceId,
}: VotingAssistantIdentity) => ({
  get_decision: createTool({
    id: 'get_decision',
    description:
      "The decision's name, phase, budget, enrolment rule and whether voting is open.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!instanceId) {
        return NO_DECISION;
      }
      try {
        return await describeEnrolmentDecision({ instanceId, authUserId });
      } catch (error) {
        return failure(error);
      }
    },
  }),

  get_registration: createTool({
    id: 'get_registration',
    description:
      "The member's registration state: registered, awaiting_address, awaiting_agree, not_started or no_registration_needed.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!instanceId) {
        return NO_DECISION;
      }
      try {
        const row = await findVoterEnrolment({
          processInstanceId: instanceId,
          authUserId,
        });
        if (isVoterEnrolled(row)) {
          return { status: 'registered' };
        }
        const decision = await describeEnrolmentDecision({
          instanceId,
          authUserId,
        });
        if (!decision.enrolment) {
          return { status: 'no_registration_needed' };
        }
        const pending = await findPendingVoterEnrolment({
          authUserId,
          processInstanceId: instanceId,
        });
        if (!pending) {
          return { status: 'not_started' };
        }
        const step = await pendingEnrolmentStep({
          processInstanceId: instanceId,
          taxonomyTermId: pending.taxonomyTermId,
          rule: decision.enrolment,
        });
        return { status: step };
      } catch (error) {
        return failure(error);
      }
    },
  }),

  get_ballot: createTool({
    id: 'get_ballot',
    description:
      "The member's draft ballot: picks with codes and costs, the allocated and remaining budget, the pick limit, and whether a ballot was already cast.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!instanceId) {
        return NO_DECISION;
      }
      try {
        const [summary, castBallotId] = await Promise.all([
          summarizeSmsBallot({ authUserId, instanceId }),
          findCastBallot({ authUserId, instanceId }),
        ]);
        return { alreadySubmitted: Boolean(castBallotId), ...summary };
      } catch (error) {
        return failure(error);
      }
    },
  }),

  list_proposals: createTool({
    id: 'list_proposals',
    description:
      "One page of five proposals from the member's ballot with codes, titles and costs. Pass the previous call's nextCursor to read the next page.",
    inputSchema: z.object({ after: z.number().int().optional() }),
    execute: async ({ after }: { after?: number }) => {
      if (!instanceId) {
        return NO_DECISION;
      }
      try {
        return await listSmsBallotPage({ authUserId, instanceId, after });
      } catch (error) {
        return failure(error);
      }
    },
  }),

  get_proposal: createTool({
    id: 'get_proposal',
    description: "One proposal's title, cost and summary, by its code.",
    inputSchema: z.object({ code: z.number().int() }),
    execute: async ({ code }: { code: number }) => {
      if (!instanceId) {
        return NO_DECISION;
      }
      try {
        const proposal = await getSmsBallotProposal({
          authUserId,
          instanceId,
          code,
        });
        return proposal ?? { error: `No proposal has the code ${code}.` };
      } catch (error) {
        return failure(error);
      }
    },
  }),

  add_picks: createTool({
    id: 'add_picks',
    description:
      "Adds proposals to the member's draft ballot by code. Returns a status per code (added, duplicate, over_budget, limit_reached or unknown) and the ballot summary.",
    inputSchema: z.object({
      codes: z.array(z.number().int()).min(1).max(10),
    }),
    execute: async ({ codes }: { codes: number[] }) => {
      if (!instanceId) {
        return NO_DECISION;
      }
      try {
        return await addSmsBallotPicks({ authUserId, instanceId, codes });
      } catch (error) {
        return failure(error);
      }
    },
  }),

  remove_pick: createTool({
    id: 'remove_pick',
    description: "Removes one pick from the member's draft ballot by code.",
    inputSchema: z.object({ code: z.number().int() }),
    execute: async ({ code }: { code: number }) => {
      if (!instanceId) {
        return NO_DECISION;
      }
      try {
        return await removeSmsBallotPick({ authUserId, instanceId, code });
      } catch (error) {
        return failure(error);
      }
    },
  }),

  move_pick: createTool({
    id: 'move_pick',
    description:
      "Moves one pick to a new position on the member's ranked draft ballot.",
    inputSchema: z.object({
      code: z.number().int(),
      position: z.number().int().min(1),
    }),
    execute: async ({ code, position }: { code: number; position: number }) => {
      if (!instanceId) {
        return NO_DECISION;
      }
      try {
        return await moveSmsBallotPick({
          authUserId,
          instanceId,
          code,
          position,
        });
      } catch (error) {
        return failure(error);
      }
    },
  }),

  submit_ballot: createTool({
    id: 'submit_ballot',
    description:
      "Casts the member's draft ballot. A cast ballot is final and cannot be changed. Call it only when the member's message explicitly says to submit or cast the ballot.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!instanceId) {
        return NO_DECISION;
      }
      try {
        return await submitSmsBallot({ authUserId, instanceId });
      } catch (error) {
        return failure(error);
      }
    },
  }),
});
