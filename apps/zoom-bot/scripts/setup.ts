/**
 * One-off provisioning for the Zoom codebase bot.
 *
 * Creates (or updates) the Managed Agent and its environment, then prints the
 * ids to paste into Vercel. Re-run it after editing `agent/system-prompt.md`:
 * that bumps the agent version, and the app always pins the latest version, so
 * no redeploy is needed.
 *
 *   export ANTHROPIC_API_KEY=...
 *   pnpm w:zoom-bot run setup
 *
 * This is a CLI, so it writes to stdout directly rather than through a logger.
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AGENT_NAME = 'Zoom codebase Q&A';
const ENVIRONMENT_NAME = 'zoom-bot';
const MODEL = 'claude-opus-5';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const systemPrompt = readFileSync(
  join(scriptDir, '..', 'agent', 'system-prompt.md'),
  'utf8',
);

// The agent only reads a repository, so it needs no tools that write or reach
// the network. Everything else is `always_allow`: with no custom tools there
// is nobody around to answer a permission prompt.
const tools: Array<Anthropic.Beta.BetaManagedAgentsAgentToolset20260401Params> =
  [
    {
      type: 'agent_toolset_20260401',
      default_config: {
        enabled: true,
        permission_policy: { type: 'always_allow' },
      },
      configs: [
        { name: 'write', enabled: false },
        { name: 'edit', enabled: false },
        { name: 'web_search', enabled: false },
        { name: 'web_fetch', enabled: false },
      ],
    },
  ];

const main = async (): Promise<void> => {
  const client = new Anthropic();

  const existingEnvironmentId = readEnv('ANTHROPIC_ENVIRONMENT_ID');
  const environmentId =
    existingEnvironmentId ?? (await createEnvironment(client));

  const existingAgentId = readEnv('ANTHROPIC_AGENT_ID');
  const agent =
    existingAgentId === null
      ? await createAgent(client)
      : await updateAgent(client, existingAgentId);

  process.stdout.write('\nPaste these into Vercel:\n');
  process.stdout.write(`ANTHROPIC_ENVIRONMENT_ID=${environmentId}\n`);
  process.stdout.write(`ANTHROPIC_AGENT_ID=${agent.id}\n`);
};

const readEnv = (name: string): string | null => {
  const value = process.env[name]?.trim();

  return value === undefined || value === '' ? null : value;
};

const createEnvironment = async (client: Anthropic): Promise<string> => {
  const environment = await client.beta.environments.create({
    name: ENVIRONMENT_NAME,
    config: {
      type: 'cloud',
      // Deny-by-default egress. The repository clone goes through Anthropic's
      // git proxy, so it should not need any outbound access of its own — if
      // session creation starts failing on the clone, switch this to
      // `{ type: 'unrestricted' }`.
      networking: { type: 'limited' },
    },
  });

  process.stdout.write(`Created environment ${environment.id}\n`);

  return environment.id;
};

const createAgent = async (
  client: Anthropic,
): Promise<{ id: string; version: number }> => {
  const agent = await client.beta.agents.create({
    name: AGENT_NAME,
    model: MODEL,
    system: systemPrompt,
    tools,
  });

  process.stdout.write(
    `Created agent ${agent.id} (version ${agent.version})\n`,
  );

  return agent;
};

const updateAgent = async (
  client: Anthropic,
  agentId: string,
): Promise<{ id: string; version: number }> => {
  const agent = await client.beta.agents.update(agentId, {
    name: AGENT_NAME,
    model: MODEL,
    system: systemPrompt,
    tools,
  });

  process.stdout.write(
    `Updated agent ${agent.id} to version ${agent.version}\n`,
  );

  return agent;
};

await main();
