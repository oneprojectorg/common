import { context, createContextKey } from '@opentelemetry/api';

const LOG_CONTEXT_KEY = createContextKey('@op/logging log context');

interface LogContext {
  posthogDistinctId?: string;
  sessionId?: string;
}

/**
 * Bind a fresh log context onto the active OTel context for the duration of
 * `fn`. The holder is mutable on purpose: values set deeper in the request
 * (e.g. once auth middleware resolves the user) stay visible to logs emitted
 * after those inner scopes unwind, such as the request-failure log in the
 * tRPC logger middleware.
 */
export function withLogContext<T>(fn: () => T): T {
  const holder: LogContext = {};
  return context.with(context.active().setValue(LOG_CONTEXT_KEY, holder), fn);
}

/**
 * Record the caller's PostHog distinct id on the active log context so every
 * log record emitted within the request carries `posthogDistinctId` — the
 * attribute PostHog Logs matches against a person's distinct ids
 * (https://posthog.com/docs/logs/link-person). No-op outside a
 * {@link withLogContext} scope.
 */
export function setLogDistinctId(distinctId: string): void {
  const holder = context.active().getValue(LOG_CONTEXT_KEY) as
    | LogContext
    | undefined;
  if (holder) {
    holder.posthogDistinctId = distinctId;
  }
}

/**
 * Record the caller's PostHog session id on the active log context so every log
 * record emitted within the request carries `sessionId` — the attribute PostHog
 * Logs matches against a session replay
 * (https://posthog.com/docs/logs/link-session-replay). No-op outside a
 * {@link withLogContext} scope.
 */
export function setLogSessionId(sessionId: string): void {
  const holder = context.active().getValue(LOG_CONTEXT_KEY) as
    | LogContext
    | undefined;
  if (holder) {
    holder.sessionId = sessionId;
  }
}

export function getLogContext(): LogContext | undefined {
  return context.active().getValue(LOG_CONTEXT_KEY) as LogContext | undefined;
}
