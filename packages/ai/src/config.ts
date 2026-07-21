export interface AIConfig {
  apiKey: string;
  baseURL: string | undefined;
}

export const getAIConfig = (): AIConfig => {
  const apiKey = process.env.AI_API_KEY;

  // Guard explicitly: without it the OpenAI SDK falls back to
  // OPENAI_API_KEY and its error message names the wrong variable.
  if (!apiKey) {
    throw new Error(
      'AI_API_KEY is not set. Add it to your environment to use @op/ai.',
    );
  }

  return {
    apiKey,
    // Any OpenAI-compatible endpoint; unset falls back to the SDK default.
    baseURL: process.env.AI_BASE_URL || undefined,
  };
};
