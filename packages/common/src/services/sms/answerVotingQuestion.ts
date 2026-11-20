import { createAIAgent } from '@op/ai';
import type { ToolsInput } from '@op/ai';
import { logger } from '@op/logging';

import { clipSmsText } from './text';

export const SMS_ANSWER_MAX_LENGTH = 160;
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

export const runVotingAssistant = async ({
  question,
  commandList,
  tools,
}: {
  question: string;
  commandList: string;
  tools: ToolsInput;
}): Promise<string | null> => {
  const agent = createAIAgent({
    name: 'sms-voting-assistant',
    instructions: instructionsFor(commandList),
    model: { modelId: process.env.AI_MODEL_ID || DEFAULT_MODEL_ID },
    tools,
  });

  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race([
      agent.generate(`Question: ${question}`, { maxSteps: MAX_TOOL_STEPS }),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ANSWER_TIMEOUT_MS);
        timer.unref?.();
      }),
    ]);
    const text = result?.text?.trim();
    return text ? clipSmsText(text, SMS_ANSWER_MAX_LENGTH) : null;
  } catch (error) {
    logger.error('SMS question could not be answered', { error });
    return null;
  } finally {
    clearTimeout(timer);
  }
};
