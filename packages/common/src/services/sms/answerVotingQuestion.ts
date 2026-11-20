import { createAIAgent } from '@op/ai';
import type { ToolsInput } from '@op/ai';
import { logger } from '@op/logging';

import type {
  ReplayMessage,
  StoredModelMessage,
} from '../conversation/modelMessage';
import { storedModelMessageSchema } from '../conversation/modelMessage';
import { SMS_MAX_BODY_LENGTH, clipSmsText } from './text';

export const SMS_ANSWER_MAX_LENGTH = SMS_MAX_BODY_LENGTH;
export const VOTING_ASSISTANT_AGENT_ID = 'sms-voting-assistant';
export const VOTING_ASSISTANT_PROMPT_VERSION = 'sms-voting-assistant/4';
const DEFAULT_MODEL_ID = 'glm-5.3-flash';
const ANSWER_TIMEOUT_MS = 25_000;
const MAX_TOOL_STEPS = 5;

const instructionsFor = (commandList: string): string =>
  [
    'You are the voting assistant for Common. Members talk to you in plain language.',
    'Do the work yourself with the tools: read the decision, register the member, build and change their ranked ballot, and submit it when told. Never tell the member to text a keyword for something your tools can do.',
    'Answer briefly in plain ASCII with no emoji: one short sentence for a simple answer.',
    'Render every list with one item per line, nothing else on the line, like: 101 Crosswalk lighting ($85,000).',
    'State every change you made, the remaining budget, and how to undo it.',
    "Call submit_ballot only when the member's message explicitly says to submit or cast the ballot. A cast ballot is final.",
    'start_registration begins registration, submit_address records a street address when the decision needs a district, and affirm_attestation completes it.',
    "Show the attestation text word for word before asking for agreement, and call affirm_attestation only when the member's message explicitly agrees to it.",
    'The SMS keyword commands below also work outside this conversation. Mention them only when the member asks about them:',
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
