import { Agent } from '@mastra/core/agent';

import { getAIModel } from './model';

// Mastra reports usage telemetry to its own PostHog (us.posthog.com) unless
// disabled. We self-host everything, so default it off; a deployment can
// still opt in by setting the variable explicitly before this module loads.
process.env.MASTRA_TELEMETRY_DISABLED ||= '1';

export interface CreateAIAgentOptions {
  name: string;
  instructions: string;
  /** Stable machine id (Mastra routes, memory, telemetry). Defaults to name. */
  id?: string;
  modelId?: string;
}

export const createAIAgent = ({
  name,
  instructions,
  id,
  modelId,
}: CreateAIAgentOptions): Agent =>
  new Agent({
    id: id ?? name,
    name,
    instructions,
    // Deferred so module-scope agents don't read env config at import time.
    model: () => getAIModel(modelId),
  });
