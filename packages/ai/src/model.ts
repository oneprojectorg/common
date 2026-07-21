import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import { getAIConfig } from './config';

// createOpenAICompatible has no default endpoint, unlike the OpenAI SDK.
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

export const getAIModel = (modelId?: string) => {
  const { apiKey, baseURL } = getAIConfig();
  const resolvedModelId = modelId || process.env.AI_MODEL;

  if (!resolvedModelId) {
    throw new Error(
      'No model id given. Pass one to getAIModel() or set AI_MODEL in your environment.',
    );
  }

  const provider = createOpenAICompatible({
    name: 'op-ai',
    apiKey,
    baseURL: baseURL ?? DEFAULT_BASE_URL,
  });

  return provider.chatModel(resolvedModelId);
};
