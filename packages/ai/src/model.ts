/**
 * The provider name every model here is registered under.
 *
 * Exported because it is also the key of `providerOptions` — the AI SDK routes
 * provider-specific request fields by provider name, so a caller passing one
 * has to spell this exactly or the options are silently dropped. Sharing the
 * constant is what stops those two from drifting apart.
 */
export const AI_PROVIDER_ID = 'op-ai';

export interface AIModelConfig {
  /**
   * Model to run on that endpoint. Required, and deliberately not defaulted from
   * the environment: a model id only names something on a particular endpoint,
   * and services here run on different models, so a single deploy-wide default
   * would silently apply one service's choice to another.
   */
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

export const resolveAIModelConfig = ({
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

  if (!modelId) {
    throw new Error('No inference model configured. Pass modelId.');
  }

  // The env key belongs to the env-configured endpoint only — never attach
  // the deploy credential to a caller-supplied (end-user) endpoint. ?? not ||
  // so an explicit empty apiKey stays keyless instead of pulling the env key.
  const resolvedApiKey =
    baseURL == null ? (apiKey ?? process.env.AI_API_KEY) : apiKey;

  return {
    providerId: AI_PROVIDER_ID,
    modelId,
    url,
    apiKey: resolvedApiKey || undefined,
  };
};
