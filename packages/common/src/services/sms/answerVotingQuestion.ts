import { createAIAgent } from '@op/ai';
import { logger } from '@op/logging';

import { clipSmsText } from './text';

export const SMS_ANSWER_MAX_LENGTH = 160;
const DEFAULT_MODEL_ID = 'glm-5.3-flash';
const ANSWER_TIMEOUT_MS = 15_000;

const instructionsFor = (commandList: string): string =>
  [
    'You help members of Common vote by SMS.',
    'Answer the question in one short sentence of at most 160 characters.',
    'Use plain ASCII with no emoji.',
    'Suggest one command from the list when it helps.',
    'You cannot cast, change or read votes; name the command that does.',
    'Commands:',
    commandList,
  ].join('\n');

export const answerVotingQuestion = async ({
  question,
  commandList,
  facts,
}: {
  question: string;
  commandList: string;
  facts: string[];
}): Promise<string | null> => {
  const agent = createAIAgent({
    name: 'sms-voting-helper',
    instructions: instructionsFor(commandList),
    model: { modelId: process.env.AI_MODEL_ID || DEFAULT_MODEL_ID },
  });

  const prompt = [...facts, `Question: ${question}`].join('\n');

  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race([
      agent.generate(prompt),
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
