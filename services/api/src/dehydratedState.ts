import type { DehydratedState } from '@tanstack/react-query';
import superjson from 'superjson';

/**
 * A server function may only return values TanStack Start can type as
 * serializable, and a query cache is `unknown` all the way down. It travels as
 * a superjson string instead — the encoding tRPC already uses — so dates and
 * other rich values survive into the client's cache.
 */
export const serializeDehydratedState = (state: DehydratedState): string =>
  superjson.stringify(state);

export const parseDehydratedState = (serialized: string): DehydratedState =>
  superjson.parse<DehydratedState>(serialized);
