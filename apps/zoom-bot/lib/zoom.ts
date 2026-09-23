import { readEnv } from './env';

export interface SendChatbotMessageInput {
  /** Channel or user JID the reply goes to (Zoom's `toJid`). */
  toJid: string;
  accountId: string;
  headText: string;
  bodyText: string;
}

interface ZoomTokenResponse {
  access_token: string;
  expires_in: number;
}

interface CachedToken {
  token: string;
  /** Epoch millis after which the cached token must not be reused. */
  expiresAt: number;
}

const TOKEN_URL = 'https://zoom.us/oauth/token?grant_type=client_credentials';
const MESSAGE_URL = 'https://api.zoom.us/v2/im/chat/messages';
/** Refresh a little early so a token never expires mid-flight. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;
/** Zoom rejects long chatbot bodies; keep well under the limit. */
const MAX_BODY_LENGTH = 4000;
const TRUNCATION_SUFFIX = '… (truncated)';

let cachedToken: CachedToken | null = null;

/**
 * Client-credentials token for the chatbot. Cached in module scope, which on
 * Vercel means "for the life of this warm instance" — good enough, and a cold
 * instance just fetches a new one.
 */
export const getChatbotToken = async (): Promise<string> => {
  const now = Date.now();

  if (cachedToken !== null && cachedToken.expiresAt > now) {
    return cachedToken.token;
  }

  const env = readEnv();
  const credentials = Buffer.from(
    `${env.zoomClientId}:${env.zoomClientSecret}`,
  ).toString('base64');

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (!response.ok) {
    throw new Error(
      `zoom-bot: Zoom token request failed (${response.status}): ${await response.text()}`,
    );
  }

  const payload: unknown = await response.json();

  if (!isZoomTokenResponse(payload)) {
    throw new Error('zoom-bot: Zoom token response had an unexpected shape.');
  }

  cachedToken = {
    token: payload.access_token,
    expiresAt: now + payload.expires_in * 1000 - TOKEN_EXPIRY_MARGIN_MS,
  };

  return payload.access_token;
};

/** Posts one chatbot message into a Zoom Team Chat channel or DM. */
export const sendChatbotMessage = async ({
  toJid,
  accountId,
  headText,
  bodyText,
}: SendChatbotMessageInput): Promise<void> => {
  const env = readEnv();
  const token = await getChatbotToken();

  const response = await fetch(MESSAGE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      robot_jid: env.zoomBotJid,
      to_jid: toJid,
      account_id: accountId,
      user_jid: toJid,
      content: {
        head: { text: headText },
        body: [{ type: 'message', text: truncate(bodyText) }],
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `zoom-bot: Zoom chat message failed (${response.status}): ${await response.text()}`,
    );
  }
};

const truncate = (text: string): string => {
  if (text.length <= MAX_BODY_LENGTH) {
    return text;
  }

  return (
    text.slice(0, MAX_BODY_LENGTH - TRUNCATION_SUFFIX.length) +
    TRUNCATION_SUFFIX
  );
};

const isZoomTokenResponse = (value: unknown): value is ZoomTokenResponse =>
  typeof value === 'object' &&
  value !== null &&
  'access_token' in value &&
  typeof value.access_token === 'string' &&
  'expires_in' in value &&
  typeof value.expires_in === 'number';
