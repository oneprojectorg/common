export interface AIModelConfig {
  modelId: string;
  /** OpenAI-compatible inference endpoint. Falls back to AI_BASE_URL. */
  baseURL?: string;
  /** Falls back to AI_API_KEY. Omit both for keyless self-hosted endpoints. */
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
  const url = baseURL || process.env.AI_BASE_URL;

  if (!url) {
    throw new Error(
      'No inference URL configured. Pass baseURL or set AI_BASE_URL in your environment.',
    );
  }

  return {
    providerId: 'op-ai',
    modelId,
    url,
    apiKey: apiKey || process.env.AI_API_KEY || undefined,
  };
};
