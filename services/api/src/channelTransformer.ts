import type { ChannelName } from '@op/common/realtime';

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

/**
 * Type guard to check if a value is a wrapped response with channel metadata.
 * Used by the client link to detect wrapped responses and extract channels.
 */
export function isWrappedResponse<T>(
  value: unknown,
): value is WrappedResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_data' in value &&
    '_meta' in value &&
    typeof (value as WrappedResponse<T>)._meta === 'object' &&
    (value as WrappedResponse<T>)._meta !== null &&
    Array.isArray((value as WrappedResponse<T>)._meta.channels)
  );
}

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
 * Extracts data and channels from a wrapped response.
 */
export function unwrapResponseWithChannels<T>(value: WrappedResponse<T>): {
  data: T;
  channels: ChannelName[];
} {
  return {
    data: value._data,
    channels: value._meta.channels,
  };
}
