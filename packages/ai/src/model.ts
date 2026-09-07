export interface AIModelConfig {
  /** Model on that endpoint. Omit to use AI_MODEL_ID. */
  modelId?: string;
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

  // Falls back beside the URL rather than at each caller, because the two are
  // one fact: a model id only names something on a particular endpoint, and
  // there is no default worth guessing for an arbitrary OpenAI-compatible
  // provider.
  //
  // Scoped to the env endpoint for the same reason the key below is. The env
  // model is the deploy's answer for the deploy's endpoint; sending it to a
  // caller-supplied one asks that provider for a model it has likely never
  // served, and the 404 names a model the caller never chose. A caller that
  // brings its own endpoint brings its own model.
  //
  // `??` not `||`: an explicit empty modelId is a misconfiguration to report,
  // not a cue to read the env.
  const resolvedModelId =
    baseURL == null ? (modelId ?? process.env.AI_MODEL_ID) : modelId;

  if (!resolvedModelId) {
    throw new Error(
      'No inference model configured. Pass modelId, or set AI_MODEL_ID for the AI_BASE_URL endpoint.',
    );
  }

  // The env key belongs to the env-configured endpoint only — never attach
  // the deploy credential to a caller-supplied (end-user) endpoint. ?? not ||
  // so an explicit empty apiKey stays keyless instead of pulling the env key.
  const resolvedApiKey =
    baseURL == null ? (apiKey ?? process.env.AI_API_KEY) : apiKey;

  return {
    providerId: 'op-ai',
    modelId: resolvedModelId,
    url,
    apiKey: resolvedApiKey || undefined,
  };
};
