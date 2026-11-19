import { createAIAgent } from '@op/ai';
import type { ToolsInput } from '@op/ai';
import { logger } from '@op/logging';

import type {
  ReplayMessage,
  StoredModelMessage,
} from '../conversation/modelMessage';
import { storedModelMessageSchema } from '../conversation/modelMessage';
import { clipSmsText } from './text';

export const SMS_ANSWER_MAX_LENGTH = 160;
export const VOTING_ASSISTANT_AGENT_ID = 'sms-voting-assistant';
export const VOTING_ASSISTANT_PROMPT_VERSION = 'sms-voting-assistant/1';
const DEFAULT_MODEL_ID = 'glm-5.3-flash';
const ANSWER_TIMEOUT_MS = 25_000;
const MAX_TOOL_STEPS = 5;

const instructionsFor = (commandList: string): string =>
  [
    'You help members of Common vote by SMS.',
    "Use the tools to read the decision, the member's registration and their draft ballot, and to change draft picks when the member asks.",
    'Answer in one short sentence of at most 160 characters, plain ASCII, no emoji.',
    'State every change you made, the remaining budget, and how to undo it (REMOVE and the code).',
    "Call submit_ballot only when the member's message explicitly says to submit or cast the ballot. A cast ballot is final.",
    'You cannot register the member: tell them to text VOTE, their address, or AGREE as the next step requires.',
    'Commands the member can text:',
    commandList,
  ].join('\n');

export interface VotingAssistantResult {
  answer: string | null;
  fullText: string | null;
  responseMessages: StoredModelMessage[];
}

const EMPTY_RESULT: VotingAssistantResult = {
  answer: null,
  fullText: null,
  responseMessages: [],
};

export const runVotingAssistant = async ({
  question,
  commandList,
  tools,
  history = [],
}: {
  question: string;
  commandList: string;
  tools: ToolsInput;
  history?: ReplayMessage[];
}): Promise<VotingAssistantResult> => {
  const agent = createAIAgent({
    name: VOTING_ASSISTANT_AGENT_ID,
    instructions: instructionsFor(commandList),
    model: { modelId: process.env.AI_MODEL_ID || DEFAULT_MODEL_ID },
    tools,
  });

  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race([
      agent.generate(
        [...history, { role: 'user', content: `Question: ${question}` }],
        { maxSteps: MAX_TOOL_STEPS },
      ),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ANSWER_TIMEOUT_MS);
        timer.unref?.();
      }),
    ]);
    if (!result) {
      return EMPTY_RESULT;
    }
    const text = result.text?.trim() ?? '';
    const responseMessages = (result.response?.messages ?? []).flatMap(
      (message): StoredModelMessage[] => {
        const parsed = storedModelMessageSchema.safeParse(message);
        return parsed.success ? [parsed.data] : [];
      },
    );
    return {
      answer: text ? clipSmsText(text, SMS_ANSWER_MAX_LENGTH) : null,
      fullText: text || null,
      responseMessages,
    };
  } catch (error) {
    logger.error('SMS question could not be answered', { error });
    return EMPTY_RESULT;
  } finally {
    clearTimeout(timer);
  }
};
