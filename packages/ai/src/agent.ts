import { Agent } from '@mastra/core/agent';

import { resolveAIModelConfig } from './model';
import type { AIModelConfig } from './model';

// Mastra phones usage telemetry home to its own PostHog (us.posthog.com). We
// run our own telemetry, so disable Mastra's unconditionally — no env knob.
process.env.MASTRA_TELEMETRY_DISABLED = '1';

export interface CreateAIAgentOptions {
  name: string;
  instructions: string;
  /** Stable machine id (Mastra routes, memory, telemetry). Defaults to name. */
  id?: string;
  model: AIModelConfig;
  /**
   * Attempts beyond the first, inside one `generate` call. Defaults to
   * {@link DEFAULT_MAX_RETRIES}.
   */
  maxRetries?: number;
}

/**
 * Retries the SDK makes inside a single call, before the caller sees anything.
 *
 * Set explicitly because the underlying default is 2 — three attempts with
 * backoff, invisible from outside. A caller that wraps `generate` in its own
 * timeout is then timing an unknown number of attempts, and a slow endpoint
 * consumes the budget three times over on its way to the same failure. One
 * retry still absorbs a 429 or a dropped connection without a full replay.
 */
const DEFAULT_MAX_RETRIES = 1;

export const createAIAgent = ({
  name,
  instructions,
  id,
  model,
  maxRetries = DEFAULT_MAX_RETRIES,
}: CreateAIAgentOptions): Agent =>
  new Agent({
    id: id ?? name,
    name,
    instructions,
    maxRetries,
    // Deferred so module-scope agents don't read env fallbacks at import time.
    model: () => resolveAIModelConfig(model),
  });
