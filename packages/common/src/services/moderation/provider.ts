import type { ModerationProvider, ModerationScores } from './types';

const REQUEST_TIMEOUT_MS = 5_000;

/**
 * HTTP moderation provider. Vendor-specific details (endpoint, auth header,
 * response parsing) are confined here. Never include the upstream URL or key
 * in thrown errors.
 */
const createHttpModerationProvider = (
  apiUrl: string,
  apiKey: string,
): ModerationProvider => ({
  scoreText: async ({ content }) => {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      // Do not include the upstream URL/key in the error.
      throw new Error(`Moderation provider returned ${response.status}`);
    }

    const data: { scores?: ModerationScores } = await response.json();

    return data.scores ?? {};
  },
});

let provider: ModerationProvider | null = null;

/**
 * Lazily builds the provider singleton from the environment. Returns null when
 * moderation isn't configured — the feature is simply off in that environment.
 */
export const getModerationProvider = (): ModerationProvider | null => {
  if (!provider) {
    const { MODERATION_API_KEY, MODERATION_API_URL } = process.env;

    if (!MODERATION_API_KEY || !MODERATION_API_URL) {
      return null;
    }

    provider = createHttpModerationProvider(
      MODERATION_API_URL,
      MODERATION_API_KEY,
    );
  }

  return provider;
};
