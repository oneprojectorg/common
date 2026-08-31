import { get, set } from '@op/cache';
import { logger } from '@op/logging';

import type { PhoneNumber } from './types';

/** How many codes one number may be sent inside {@link WINDOW_MS}. */
const MAX_SENDS = 5;

/** The window the count applies to. */
const WINDOW_MS = 60 * 60 * 1000;

/** Shared prefix, so these keys are recognisable in Redis. */
const KEY_PREFIX = 'smsSend';

/** What the window holds while it is open. */
interface SendWindow {
  count: number;
  startedAt: number;
}

/**
 * Whether we may text a code to this number.
 *
 * Each send costs money, and the endpoint that triggers one answers the public
 * internet before any identity exists. The per-IP limit in front of it resets
 * on every deploy, is held in one process, and counts no numbers, so it does
 * not bound spend on its own.
 *
 * This counts per number in Redis, so it survives a deploy and holds across
 * every instance.
 *
 * It does not bound a caller who rotates through many different numbers. That
 * is the expensive attack — premium-rate numbers in a revenue-share range —
 * and the control for it is Twilio's own geographic permissions, which decide
 * which countries the account may text at all. Set those as well.
 *
 * Answers `true` when Redis does not, rather than blocking sign-in on cache
 * availability. The per-IP limit still applies in that case.
 *
 * @param phone - The number a code would go to.
 * @param now - The current time, injected so a test needs no clock.
 * @returns Whether the send may proceed.
 */
export const allowPhoneSend = async (
  phone: PhoneNumber,
  now: number = Date.now(),
): Promise<boolean> => {
  const key = `${KEY_PREFIX}:${phone}`;

  try {
    const current = readWindow(await get(key));

    // No window, or the previous one has run out: this send opens a new one.
    if (!current || now - current.startedAt >= WINDOW_MS) {
      await set(key, { count: 1, startedAt: now }, WINDOW_MS / 1000);
      return true;
    }

    if (current.count >= MAX_SENDS) {
      logger.warn('Refused an SMS send: the number reached its limit', {
        count: current.count,
      });
      return false;
    }

    // Keep the original `startedAt`, so the window cannot be pushed forward
    // indefinitely by sending again.
    await set(
      key,
      { count: current.count + 1, startedAt: current.startedAt },
      Math.ceil((current.startedAt + WINDOW_MS - now) / 1000),
    );
    return true;
  } catch (error) {
    logger.error('Could not read the SMS send limit', { error });
    return true;
  }
};

/** Reads a stored window without trusting the shape Redis returned. */
const readWindow = (value: unknown): SendWindow | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const count = Reflect.get(value, 'count');
  const startedAt = Reflect.get(value, 'startedAt');
  return typeof count === 'number' && typeof startedAt === 'number'
    ? { count, startedAt }
    : null;
};
