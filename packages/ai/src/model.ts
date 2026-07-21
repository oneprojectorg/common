export interface AIModelConfig {
  modelId: string;
  /** OpenAI-compatible inference endpoint. Omit to use AI_BASE_URL. */
  baseURL?: string;
  /** Omit to use AI_API_KEY (env endpoint only). Empty string = keyless. */
  apiKey?: string;
}

export interface ResolvedAIModel {
  providerId: string;
  modelId: string;
  url: string;
  apiKey: string | undefined;
}

export const resolveAIModel = ({
  modelId,
  baseURL,
  apiKey,
}: AIModelConfig): ResolvedAIModel => {
  // ?? not ||: an explicit empty baseURL (e.g. a blank user setting) must
  // error below, not silently reroute prompts to the env fallback endpoint.
  const url = baseURL ?? process.env.AI_BASE_URL;

  if (!url) {
    throw new Error(
      'No inference URL configured. Pass baseURL or set AI_BASE_URL in your environment.',
    );
  }

  // The env key belongs to the env-configured endpoint only — never attach
  // the deploy credential to a caller-supplied (end-user) endpoint.
  const resolvedApiKey =
    baseURL == null ? apiKey || process.env.AI_API_KEY : apiKey;

  return {
    providerId: 'op-ai',
    modelId,
    url,
    apiKey: resolvedApiKey || undefined,
  };
};
