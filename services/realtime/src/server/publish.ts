/**
 * Server-side Centrifugo API client for publishing messages
 * Uses the Centrifugo HTTP API for server-to-client communication
 *
 * https://centrifugal.dev/docs/server/server_api
 */

function getCentrifugoConfig() {
  const url = process.env.CENTRIFUGO_URL;
  const apiKey = process.env.CENTRIFUGO_API_KEY;

  if (!url) {
    throw new Error('Missing required environment variable: CENTRIFUGO_URL');
  }

  if (!apiKey) {
    throw new Error('Missing required environment variable: CENTRIFUGO_API_KEY');
  }

  return { url, apiKey };
}

interface CentrifugoApiResponse {
  error?: {
    code: number;
    message: string;
  };
  result?: unknown;
}

async function centrifugoApiRequest<T = unknown>(
  method: string,
  params: Record<string, unknown>,
): Promise<T> {
  const { url, apiKey } = getCentrifugoConfig();

  const response = await fetch(`${url}/api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `apikey ${apiKey}`,
    },
    body: JSON.stringify({
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`Centrifugo API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as CentrifugoApiResponse;

  if (data.error) {
    throw new Error(`Centrifugo error: ${data.error.message} (code: ${data.error.code})`);
  }

  return data.result as T;
}

/**
 * Publish a message to a channel from the server
 */
export async function publish<T = unknown>(
  channel: string,
  data: T,
): Promise<void> {
  await centrifugoApiRequest('publish', { channel, data });
}

/**
 * Broadcast a message to multiple channels from the server
 */
export async function broadcast<T = unknown>(
  channels: string[],
  data: T,
): Promise<void> {
  await centrifugoApiRequest('broadcast', { channels, data });
}

/**
 * Get presence information for a channel
 */
export async function presence(
  channel: string,
): Promise<Record<string, { client: string; user: string }>> {
  const result = await centrifugoApiRequest<{
    presence: Record<string, { client: string; user: string }>;
  }>('presence', { channel });
  return result.presence;
}

/**
 * Get presence stats for a channel
 */
export async function presenceStats(
  channel: string,
): Promise<{ num_clients: number; num_users: number }> {
  return centrifugoApiRequest<{ num_clients: number; num_users: number }>(
    'presence_stats',
    { channel },
  );
}

/**
 * Get history for a channel
 */
export async function history<T = unknown>(
  channel: string,
  options?: { limit?: number; since?: { offset: number; epoch: string } },
): Promise<{ publications: Array<{ data: T; offset: number }> }> {
  return centrifugoApiRequest<{
    publications: Array<{ data: T; offset: number }>;
  }>('history', { channel, ...options });
}

/**
 * Disconnect a user from all their connections
 */
export async function disconnect(user: string): Promise<void> {
  await centrifugoApiRequest('disconnect', { user });
}

/**
 * Unsubscribe a user from a channel
 */
export async function unsubscribe(user: string, channel: string): Promise<void> {
  await centrifugoApiRequest('unsubscribe', { user, channel });
}
