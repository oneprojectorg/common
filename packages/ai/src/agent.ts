import { Agent } from '@mastra/core/agent';

import { getAIModel } from './model';

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
