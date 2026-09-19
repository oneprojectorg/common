import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@op/logging';

import { readEnv } from './env';
import { sendChatbotMessage } from './zoom';

export interface AnswerQuestionInput {
  question: string;
  /** Channel or user JID the answer goes back to. */
  toJid: string;
  accountId: string;
}

interface CollectedAnswer {
  text: string;
  /** True when our own deadline stopped the session before it finished. */
  cutShort: boolean;
}

interface CollectAnswerInput {
  client: Anthropic;
  sessionId: string;
  question: string;
  deadline: number;
}

const HEAD_TEXT = 'Codebase Q&A';
const ACKNOWLEDGEMENT = 'Looking into it… this usually takes a minute or two.';
const EMPTY_ANSWER = "I couldn't find an answer to that in the codebase.";
const FAILURE_MESSAGE =
  'Sorry, something went wrong while looking that up. An engineer can check the logs.';
const CUT_SHORT_NOTE =
  '(This answer was cut short by the time limit — ask again for a fuller one.)';
/** Leaves headroom under the route's `maxDuration` for the final Zoom post. */
const ANSWER_DEADLINE_MS = 240_000;

/**
 * Runs one Managed Agents session against the repo and posts the result back
 * to Zoom. Called from `after()`, so it must never reject: every failure ends
 * as a logged error plus a best-effort message to the user.
 */
export const answerQuestion = async ({
  question,
  toJid,
  accountId,
}: AnswerQuestionInput): Promise<void> => {
  try {
    const env = readEnv();

    await sendChatbotMessage({
      toJid,
      accountId,
      headText: HEAD_TEXT,
      bodyText: ACKNOWLEDGEMENT,
    });

    const client = new Anthropic();

    // The agent and environment are created once by `pnpm w:zoom-bot setup:agent`.
    // Never create them here — that would make a new version per question.
    const session = await client.beta.sessions.create({
      agent: env.anthropicAgentId,
      environment_id: env.anthropicEnvironmentId,
      title: `Zoom question ${new Date().toISOString()}`,
      resources: [
        {
          type: 'github_repository',
          url: env.githubRepoUrl,
          // Never enters the sandbox: Anthropic's git proxy injects it.
          authorization_token: env.githubToken,
          mount_path: '/workspace/common',
          checkout: { type: 'branch', name: env.githubRepoBranch },
        },
      ],
      budget: {
        type: 'limit',
        max_list_cost: { amount: env.sessionBudgetCents, currency: 'USD' },
      },
    });

    const answer = await collectAnswer({
      client,
      sessionId: session.id,
      question,
      deadline: Date.now() + ANSWER_DEADLINE_MS,
    });

    const body = answer.text === '' ? EMPTY_ANSWER : answer.text;
    const note = answer.cutShort ? `\n\n${CUT_SHORT_NOTE}` : '';
    const traceUrl = `https://platform.claude.com/workspaces/${env.anthropicWorkspaceId}/sessions/${session.id}`;

    await sendChatbotMessage({
      toJid,
      accountId,
      headText: HEAD_TEXT,
      bodyText:
        `${body}${note}\n\n—\n` +
        `Read from the code on branch ${env.githubRepoBranch}. Not a guarantee of production behaviour.\n` +
        `Trace for engineers: ${traceUrl}`,
    });
  } catch (error) {
    logger.error('zoom-bot: answering failed', { error });

    try {
      await sendChatbotMessage({
        toJid,
        accountId,
        headText: HEAD_TEXT,
        bodyText: FAILURE_MESSAGE,
      });
    } catch (replyError) {
      logger.error('zoom-bot: could not report the failure to Zoom', {
        error: replyError,
      });
    }
  }
};

/**
 * Opens the event stream first, then sends the question — events that happen
 * before the stream is open would otherwise arrive as one buffered batch.
 */
const collectAnswer = async ({
  client,
  sessionId,
  question,
  deadline,
}: CollectAnswerInput): Promise<CollectedAnswer> => {
  const stream = await client.beta.sessions.events.stream(sessionId);

  await client.beta.sessions.events.send(sessionId, {
    events: [
      { type: 'user.message', content: [{ type: 'text', text: question }] },
    ],
  });

  const chunks: string[] = [];
  let cutShort = false;

  for await (const event of stream) {
    if (Date.now() > deadline) {
      cutShort = true;
      await client.beta.sessions.events.send(sessionId, {
        events: [{ type: 'user.interrupt' }],
      });
      break;
    }

    if (event.type === 'agent.message') {
      for (const block of event.content) {
        if (block.type === 'text') {
          chunks.push(block.text);
        }
      }
      continue;
    }

    if (event.type === 'session.error') {
      logger.warn('zoom-bot: session reported an error', {
        sessionId,
        errorType: event.error.type,
      });
      continue;
    }

    if (event.type === 'session.status_terminated') {
      break;
    }

    if (event.type === 'session.status_idle') {
      // No custom tools are configured and every built-in tool is
      // `always_allow`, so this branch should be unreachable.
      if (event.stop_reason.type === 'requires_action') {
        continue;
      }

      if (
        event.stop_reason.type === 'retries_exhausted' ||
        event.stop_reason.type === 'budget_reached'
      ) {
        logger.warn('zoom-bot: session stopped before finishing', {
          sessionId,
          stopReason: event.stop_reason.type,
        });
        cutShort = true;
      }

      break;
    }
  }

  return { text: chunks.join('\n\n').trim(), cutShort };
};
