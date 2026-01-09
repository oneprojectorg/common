import type { ChannelName } from '@op/common/realtime';
import { z } from 'zod';

/**
 * Shape of a response wrapped with channel metadata.
 * The middleware wraps successful query responses in this format,
 * and the client link unwraps it before data reaches the application.
 */
export type WrappedResponse<T> = {
  _data: T;
  _meta: {
    channels: ChannelName[];
  };
};

const WrappedResponseSchema = z.object({
  _data: z.unknown(),
  _meta: z.object({
    channels: z.array(z.string()),
  }),
});

/**
 * Wraps response data with channel metadata.
 */
export function wrapResponseWithChannels<T>(
  data: T,
  channels: ChannelName[],
): WrappedResponse<T> {
  return {
    _data: data,
    _meta: { channels },
  };
}

/**
 * Attempts to extract data and channels from a wrapped response.
 * Returns null if the value is not a valid wrapped response.
 */
export function unwrapResponseWithChannels<T>(
  value: unknown,
): { data: T; channels: ChannelName[] } | null {
  const parsed = WrappedResponseSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  return {
    data: parsed.data._data as T,
    channels: parsed.data._meta.channels as ChannelName[],
  };
}
