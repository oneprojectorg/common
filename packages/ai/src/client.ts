import { OpenAI } from 'openai';

let client: OpenAI | undefined;

export const getAIClient = (): OpenAI => {
  if (!client) {
    const apiKey = process.env.AI_API_KEY;

    // Guard explicitly: without it the OpenAI SDK falls back to
    // OPENAI_API_KEY and its error message names the wrong variable.
    if (!apiKey) {
      throw new Error(
        'AI_API_KEY is not set. Add it to your environment to use @op/ai.',
      );
    }

    client = new OpenAI({
      apiKey,
      // Any OpenAI-compatible endpoint; unset falls back to the SDK default.
      baseURL: process.env.AI_BASE_URL || undefined,
    });
  }

  return client;
};
