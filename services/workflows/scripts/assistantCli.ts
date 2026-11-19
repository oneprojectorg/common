import {
  VOTING_ASSISTANT_AGENT_ID,
  VOTING_ASSISTANT_PROMPT_VERSION,
  appendConversationItems,
  ensureConversation,
  getDecisionBySlug,
  getGeocoder,
  listRecentReplayMessages,
  parsePhoneNumber,
  runVotingAssistant,
  startNewConversation,
  toGoTruePhoneFormat,
  votingAssistantTools,
} from '@op/common';
import { db, eq } from '@op/db/client';
import { authUsers } from '@op/db/schema';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';

import { SMS_COMMAND_LIST_MESSAGE } from '../src/functions/notifications/smsReply';

const USAGE = [
  'Usage: pnpm w:workflows assistant:cli (--phone <E.164> | --email <address>) [--decision <slug>] [--new]',
  '',
  '--new starts a fresh conversation thread; the old one stays stored.',
  '',
  'A REPL for the SMS voting assistant against the local dev database.',
  'Type a question and read the answer; /quit or Ctrl-D exits.',
].join('\n');

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const resolveAuthUserId = async ({
  phone,
  email,
}: {
  phone?: string;
  email?: string;
}): Promise<string> => {
  if (phone) {
    const parsed = parsePhoneNumber(phone);
    const [row] = await db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.phone, toGoTruePhoneFormat(parsed)))
      .limit(1);
    return row?.id ?? fail(`No account holds the phone number ${phone}.`);
  }
  if (email) {
    const [row] = await db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.email, email))
      .limit(1);
    return row?.id ?? fail(`No account holds the email ${email}.`);
  }
  return fail(USAGE);
};

const main = async () => {
  const { values } = parseArgs({
    options: {
      phone: { type: 'string' },
      email: { type: 'string' },
      decision: { type: 'string' },
      new: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help || (!values.phone && !values.email)) {
    console.log(USAGE);
    process.exit(values.help ? 0 : 1);
  }
  if (!process.env.DATABASE_URL) {
    fail('DATABASE_URL is not set. Add it to .env.local at the repo root.');
  }
  if (!process.env.AI_BASE_URL) {
    fail('AI_BASE_URL is not set. Add it to .env.local at the repo root.');
  }

  const authUserId = await resolveAuthUserId(values);

  let instanceId: string | null = null;
  let decisionName: string | null = null;
  if (values.decision) {
    const decision = await getDecisionBySlug({
      user: { id: authUserId },
      slug: values.decision,
    });
    instanceId = decision.processInstance.id;
    decisionName = decision.name;
  }

  const conversation = values.new
    ? await startNewConversation({ authUserId, processInstanceId: instanceId })
    : await ensureConversation({ authUserId, processInstanceId: instanceId });

  console.log(
    decisionName
      ? `Chatting about "${decisionName}" (conversation ${conversation.id}).`
      : `Chatting with no decision in scope (conversation ${conversation.id}).`,
  );
  console.log('Type a question; /quit or Ctrl-D exits.\n');

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'you> ',
  });

  // A hand-rolled queue, not the async iterator: the iterator drops lines
  // buffered while a turn is in flight once piped stdin reaches EOF.
  const lines: string[] = [];
  let closed = false;
  let wake: (() => void) | undefined;
  readline.on('line', (line) => {
    lines.push(line);
    wake?.();
  });
  readline.on('close', () => {
    closed = true;
    wake?.();
  });
  const nextLine = async (): Promise<string | null> => {
    for (;;) {
      const line = lines.shift();
      if (line !== undefined) {
        return line;
      }
      if (closed) {
        return null;
      }
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
      wake = undefined;
    }
  };

  readline.prompt();
  for (;;) {
    const line = await nextLine();
    if (line === null) {
      break;
    }
    const question = line.trim();
    if (!question) {
      if (!closed) {
        readline.prompt();
      }
      continue;
    }
    if (question === '/quit') {
      break;
    }

    const history = await listRecentReplayMessages({
      conversationId: conversation.id,
      limit: 10,
    });
    const { answer, responseMessages } = await runVotingAssistant({
      question,
      commandList: SMS_COMMAND_LIST_MESSAGE,
      tools: votingAssistantTools({
        authUserId,
        instanceId,
        geocode: getGeocoder(),
      }),
      history,
    });

    for (const message of responseMessages) {
      if (typeof message.content === 'string') {
        continue;
      }
      for (const part of message.content) {
        if (part.type === 'tool-call') {
          console.log(
            `[tool] ${String(part.toolName)} ${JSON.stringify(part.input ?? {})}`,
          );
        }
      }
    }

    await appendConversationItems({
      conversationId: conversation.id,
      runId: randomUUID(),
      items: [
        { message: { role: 'user', content: question } },
        ...responseMessages.map((message) => ({
          message,
          agentId: VOTING_ASSISTANT_AGENT_ID,
          promptVersion: VOTING_ASSISTANT_PROMPT_VERSION,
        })),
      ],
    });

    console.log(`assistant> ${answer ?? '(no answer)'}\n`);
    if (!closed) {
      readline.prompt();
    }
  }

  readline.close();
  process.exit(0);
};

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
