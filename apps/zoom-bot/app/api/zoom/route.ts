import { logger } from '@op/logging';
import { after } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { answerQuestion } from '../../../lib/answer';
import { requireEnv } from '../../../lib/env';
import { sendChatbotMessage } from '../../../lib/zoom';

export const maxDuration = 300; // seconds; raise to 800 on Vercel Fluid compute if answers get cut off
export const dynamic = 'force-dynamic';

interface ZoomWebhook {
  event: string;
  payload: unknown;
}

interface UrlValidationPayload {
  plainToken: string;
}

interface BotNotificationPayload {
  /** Message text, or the text after the slash command. */
  cmd: string;
  /** Channel or user JID to reply to. */
  toJid: string;
  accountId: string;
  userJid: string;
}

const HEAD_TEXT = 'Codebase Q&A';
const USAGE_MESSAGE =
  'Ask me a question about how our product behaves and I will read the code to answer it — for example "what permissions does an invited process member get?".';
/** Zoom rejects replayed webhooks; so do we. */
const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

export const POST = async (request: Request): Promise<Response> => {
  // Must be the raw bytes: the signature is computed over the body as sent.
  const rawBody = await request.text();
  const secretToken = requireEnv('ZOOM_WEBHOOK_SECRET_TOKEN');

  const timestamp = request.headers.get('x-zm-request-timestamp');
  const signature = request.headers.get('x-zm-signature');

  if (
    timestamp === null ||
    signature === null ||
    !isFreshTimestamp(timestamp) ||
    !isValidSignature({ rawBody, timestamp, signature, secretToken })
  ) {
    return new Response('Unauthorized', { status: 401 });
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  if (!isZoomWebhook(parsed)) {
    return new Response('Bad Request', { status: 400 });
  }

  // Zoom re-validates every 72 hours and disables the subscription after six
  // failures, so this branch must keep working even if nothing else does.
  if (parsed.event === 'endpoint.url_validation') {
    if (!isUrlValidationPayload(parsed.payload)) {
      return new Response('Bad Request', { status: 400 });
    }

    return Response.json({
      plainToken: parsed.payload.plainToken,
      encryptedToken: createHmac('sha256', secretToken)
        .update(parsed.payload.plainToken)
        .digest('hex'),
    });
  }

  if (parsed.event === 'bot_notification') {
    return handleBotNotification(parsed.payload);
  }

  logger.info('zoom-bot: ignoring unhandled Zoom event', {
    event: parsed.event,
  });

  return Response.json({ ok: true });
};

export const GET = async (): Promise<Response> => Response.json({ ok: true });

const handleBotNotification = async (payload: unknown): Promise<Response> => {
  if (!isBotNotificationPayload(payload)) {
    logger.warn('zoom-bot: bot_notification payload had an unexpected shape');

    return Response.json({ ok: true });
  }

  const allowedAccountId = process.env.ZOOM_ACCOUNT_ID?.trim();

  if (
    allowedAccountId !== undefined &&
    allowedAccountId !== '' &&
    allowedAccountId !== payload.accountId
  ) {
    logger.warn('zoom-bot: ignoring webhook from an unexpected Zoom account', {
      accountId: payload.accountId,
    });

    return Response.json({ ok: true });
  }

  const question = payload.cmd.trim();

  if (question === '') {
    try {
      await sendChatbotMessage({
        toJid: payload.toJid,
        accountId: payload.accountId,
        headText: HEAD_TEXT,
        bodyText: USAGE_MESSAGE,
      });
    } catch (error) {
      logger.error('zoom-bot: could not send the usage message', { error });
    }

    return Response.json({ ok: true });
  }

  // Zoom retries when it does not get a 2xx within a few seconds, so answer
  // the webhook now and keep working in the background until `maxDuration`.
  after(() =>
    answerQuestion({
      question,
      toJid: payload.toJid,
      accountId: payload.accountId,
    }),
  );

  return Response.json({ ok: true });
};

const isValidSignature = ({
  rawBody,
  timestamp,
  signature,
  secretToken,
}: {
  rawBody: string;
  timestamp: string;
  signature: string;
  secretToken: string;
}): boolean => {
  const expected = `v0=${createHmac('sha256', secretToken)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest('hex')}`;

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const receivedBuffer = Buffer.from(signature, 'utf8');

  // timingSafeEqual throws on a length mismatch, and the length of a hex
  // digest is not a secret.
  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
};

const isFreshTimestamp = (timestamp: string): boolean => {
  const value = Number(timestamp);

  if (!Number.isFinite(value)) {
    return false;
  }

  // Zoom sends seconds; tolerate milliseconds in case that ever changes.
  const millis = value > 1e12 ? value : value * 1000;

  return Math.abs(Date.now() - millis) <= SIGNATURE_TOLERANCE_MS;
};

const isZoomWebhook = (value: unknown): value is ZoomWebhook =>
  typeof value === 'object' &&
  value !== null &&
  'event' in value &&
  typeof value.event === 'string' &&
  'payload' in value;

const isUrlValidationPayload = (
  value: unknown,
): value is UrlValidationPayload =>
  typeof value === 'object' &&
  value !== null &&
  'plainToken' in value &&
  typeof value.plainToken === 'string';

// Only the fields we act on are validated; Zoom sends more (userName,
// channelName, …) and a stricter guard would reject perfectly good questions.
const isBotNotificationPayload = (
  value: unknown,
): value is BotNotificationPayload =>
  typeof value === 'object' &&
  value !== null &&
  'cmd' in value &&
  typeof value.cmd === 'string' &&
  'toJid' in value &&
  typeof value.toJid === 'string' &&
  'accountId' in value &&
  typeof value.accountId === 'string' &&
  'userJid' in value &&
  typeof value.userJid === 'string';
