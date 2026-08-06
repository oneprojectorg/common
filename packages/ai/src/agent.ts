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
    model: () => resolveAIModelConfig(model),
  });
