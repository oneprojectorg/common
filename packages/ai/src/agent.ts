import { Agent } from '@mastra/core/agent';

import { resolveAIModel } from './model';
import type { AIModelConfig } from './model';

// Mastra reports usage telemetry to its own PostHog (us.posthog.com) unless
// disabled. We self-host everything, so default it off. To opt back in, set
// MASTRA_TELEMETRY_DISABLED=0 (any value outside Mastra's disabled set works;
// the default only applies once this module has loaded).
process.env.MASTRA_TELEMETRY_DISABLED ||= '1';

export interface CreateAIAgentOptions {
  name: string;
  instructions: string;
  /** Stable machine id (Mastra routes, memory, telemetry). Defaults to name. */
  id?: string;
  model: AIModelConfig;
}

export const createAIAgent = ({
  name,
  instructions,
  id,
  model,
}: CreateAIAgentOptions): Agent =>
  new Agent({
    id: id ?? name,
    name,
    instructions,
    // Deferred so module-scope agents don't read env fallbacks at import time.
    model: () => resolveAIModel(model),
  });
