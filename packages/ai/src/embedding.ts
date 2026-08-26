import { resolveAIModelConfig } from './model';
import type { AIModelConfig } from './model';

export interface CreateEmbeddingsOptions {
  model: AIModelConfig;
  /** One vector is returned per entry, in the same order. */
  texts: string[];
}

/** One embedding vector per input text, in input order. */
export type Embeddings = number[][];

interface EmbeddingResponseEntry {
  /** Position of this vector's input in the request. */
  index: number;
  embedding: number[];
}

const isEmbeddingResponseEntry = (
  value: unknown,
): value is EmbeddingResponseEntry =>
  typeof value === 'object' &&
  value !== null &&
  'index' in value &&
  typeof value.index === 'number' &&
  'embedding' in value &&
  Array.isArray(value.embedding) &&
  value.embedding.every((component: unknown) => typeof component === 'number');

const isEmbeddingResponse = (
  value: unknown,
): value is { data: EmbeddingResponseEntry[] } =>
  typeof value === 'object' &&
  value !== null &&
  'data' in value &&
  Array.isArray(value.data) &&
  value.data.every(isEmbeddingResponseEntry);

/**
 * Embeds `texts` through the OpenAI-compatible `/embeddings` route of the
 * endpoint `resolveAIModelConfig` resolves.
 *
 * Plain `fetch` rather than an SDK: the request is one POST with one JSON body,
 * and `@mastra/core` only models chat agents. The same credential rule applies —
 * `resolveAIModelConfig` refuses to attach the deploy key to a caller-supplied
 * endpoint.
 *
 * Throws when the endpoint is unconfigured, the request fails, or the response
 * doesn't carry one vector per input; callers decide whether that's fatal.
 */
export const createEmbeddings = async ({
  model,
  texts,
}: CreateEmbeddingsOptions): Promise<Embeddings> => {
  if (texts.length === 0) {
    return [];
  }

  const { url, modelId, apiKey } = resolveAIModelConfig(model);

  const response = await fetch(`${url.replace(/\/$/, '')}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ model: modelId, input: texts }),
  });

  if (!response.ok) {
    throw new Error(
      `Embedding request failed: ${response.status} ${response.statusText}`,
    );
  }

  const payload: unknown = await response.json();

  if (!isEmbeddingResponse(payload)) {
    throw new Error('Embedding response did not contain numeric vectors');
  }

  if (payload.data.length !== texts.length) {
    throw new Error(
      `Embedding response returned ${payload.data.length} vectors for ${texts.length} inputs`,
    );
  }

  // `index` is part of the OpenAI response for exactly this reason: the entries
  // carry their input position and aren't promised to arrive in request order.
  return [...payload.data]
    .sort((left, right) => left.index - right.index)
    .map((entry) => entry.embedding);
};
