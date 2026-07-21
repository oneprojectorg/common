export { getAIClient } from './client';
export { getAIModel } from './model';
export { createAIAgent } from './agent';
export type { CreateAIAgentOptions } from './agent';
export type { Agent } from '@mastra/core/agent';
// Type-only: a value re-export would let consumers `new OpenAI()` around the
// configured client and pull the SDK into browser bundles.
export type { OpenAI } from 'openai';
