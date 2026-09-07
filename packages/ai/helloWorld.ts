import dotenv from 'dotenv';

import { createAIAgent } from './src/index';

// Live smoke test against the configured provider — run manually with
// `pnpm w:ai hello [modelId]`. Deliberately a script, not a test: it needs a
// real key and a network round trip, neither of which belongs in `pnpm test`.

// The monorepo root, then the bare repository root for git worktrees — same
// paths as services/db/drizzle.config.ts.
dotenv.config({ path: ['../../.env.local', '../../../.env.local'] });

// Model ids are per-agent in code, not env config. Pass one on the CLI to try
// a different model: https://docs.together.ai/docs/serverless-models
const modelId = process.argv[2] ?? 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
const baseURL = process.env.AI_BASE_URL;

// Falsiness, not `== null`: dotenv reads the example file's `AI_API_KEY=` as
// '', so a fresh checkout would otherwise sail through and fire a real
// unauthenticated request at the configured vendor. model.ts still supports
// keyless endpoints (ollama, vLLM) for library callers — this script does not.
if (!baseURL || !process.env.AI_API_KEY) {
  console.error(
    'Set AI_BASE_URL and AI_API_KEY in .env.local first. For together.ai: ' +
      'AI_BASE_URL=https://api.together.ai/v1 and a key from ' +
      'https://api.together.ai/settings/api-keys',
  );
  process.exit(1);
}

const agent = createAIAgent({
  name: 'hello-world',
  instructions: 'Reply with a single short sentence.',
  model: { modelId },
});

console.log(`Asking ${modelId} at ${baseURL} ...`);

// Ends on one actionable line. Mastra still logs its own copy of an upstream
// API error above this; what the catch removes is the duplicate rejection dump.
try {
  const result = await agent.generate('Say hello to the Common team.');

  console.log(result.text);
} catch (error) {
  if (!(error instanceof Error)) throw error;

  // AI SDK errors (name `AI_APICallError` etc.) fold the vendor's own message
  // in, so the one-liner is the whole story. Anything else is unexpected here
  // and keeps its stack rather than being flattened to a dead-end sentence.
  console.error(
    error.name.startsWith('AI_')
      ? `Request failed: ${error.message}`
      : `Request failed unexpectedly: ${error.stack ?? error.message}`,
  );
  process.exit(1);
}
