export { getAIClient } from './client';
// Type-only: a value re-export would let consumers `new OpenAI()` around the
// configured client and pull the SDK into browser bundles.
export type { OpenAI } from 'openai';
