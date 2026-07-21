import { OpenAI } from 'openai';

const TOGETHER_BASE_URL = 'https://api.together.xyz/v1';

let client: OpenAI | undefined;

export const getAIClient = (): OpenAI => {
  if (!client) {
    const apiKey = process.env.TOGETHER_API_KEY;

    // Guard explicitly: without it the OpenAI SDK falls back to
    // OPENAI_API_KEY and its error message names the wrong variable.
    if (!apiKey) {
      throw new Error(
        'TOGETHER_API_KEY is not set. Add it to your environment to use @op/ai.',
      );
    }

    client = new OpenAI({ apiKey, baseURL: TOGETHER_BASE_URL });
  }

  return client;
};
