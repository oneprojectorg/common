export interface Env {
  /** Zoom "General App" OAuth client id (account-level app). */
  zoomClientId: string;
  zoomClientSecret: string;
  /** The chatbot's own JID, from the Team Chat feature page. */
  zoomBotJid: string;
  /** Webhook secret token, used for signature checks and URL validation. */
  zoomWebhookSecretToken: string;
  /** When set, webhooks from any other Zoom account are ignored. */
  zoomAccountId: string | null;
  /** Managed Agent id created by `pnpm w:zoom-bot setup:agent`. */
  anthropicAgentId: string;
  /** Managed Agent environment id created by the same script. */
  anthropicEnvironmentId: string;
  /** Only used to build the console trace URL we print to Zoom. */
  anthropicWorkspaceId: string;
  /** Fine-grained PAT with Contents: Read on the repo below. */
  githubToken: string;
  githubRepoUrl: string;
  githubRepoBranch: string;
  /** Per-session spend ceiling, in whole US cents, as an integer string. */
  sessionBudgetCents: string;
}

const DEFAULT_GITHUB_REPO_URL = 'https://github.com/oneprojectorg/common';
const DEFAULT_GITHUB_REPO_BRANCH = 'dev';
const DEFAULT_SESSION_BUDGET_CENTS = '300';
const DEFAULT_WORKSPACE_ID = 'default';

/**
 * Reads and validates every variable the bot needs. Call this inside a request
 * handler, never at module scope, so `next build` never needs the secrets.
 */
export const readEnv = (): Env => {
  // The Anthropic SDK reads this itself; we only check that it is present so
  // the failure names the variable instead of surfacing as a 401 later.
  requireEnv('ANTHROPIC_API_KEY');

  return {
    zoomClientId: requireEnv('ZOOM_CLIENT_ID'),
    zoomClientSecret: requireEnv('ZOOM_CLIENT_SECRET'),
    zoomBotJid: requireEnv('ZOOM_BOT_JID'),
    zoomWebhookSecretToken: requireEnv('ZOOM_WEBHOOK_SECRET_TOKEN'),
    zoomAccountId: readOptionalEnv('ZOOM_ACCOUNT_ID'),
    anthropicAgentId: requireEnv('ANTHROPIC_AGENT_ID'),
    anthropicEnvironmentId: requireEnv('ANTHROPIC_ENVIRONMENT_ID'),
    anthropicWorkspaceId:
      readOptionalEnv('ANTHROPIC_WORKSPACE_ID') ?? DEFAULT_WORKSPACE_ID,
    githubToken: requireEnv('GITHUB_TOKEN'),
    githubRepoUrl:
      readOptionalEnv('GITHUB_REPO_URL') ?? DEFAULT_GITHUB_REPO_URL,
    githubRepoBranch:
      readOptionalEnv('GITHUB_REPO_BRANCH') ?? DEFAULT_GITHUB_REPO_BRANCH,
    sessionBudgetCents: readSessionBudgetCents(),
  };
};

/**
 * Reads a single required variable. The webhook route uses this on its own for
 * the signature check, so Zoom's URL validation keeps working even while the
 * Anthropic or GitHub variables are still missing.
 */
export const requireEnv = (name: string): string => {
  const value = readOptionalEnv(name);

  if (value === null) {
    throw new Error(
      `zoom-bot: missing required environment variable ${name}. See apps/zoom-bot/.env.example.`,
    );
  }

  return value;
};

const readOptionalEnv = (name: string): string | null => {
  const value = process.env[name]?.trim();

  return value === undefined || value === '' ? null : value;
};

const readSessionBudgetCents = (): string => {
  const value = readOptionalEnv('SESSION_BUDGET_CENTS');

  if (value === null) {
    return DEFAULT_SESSION_BUDGET_CENTS;
  }

  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(
      `zoom-bot: SESSION_BUDGET_CENTS must be a positive integer number of US cents, got "${value}".`,
    );
  }

  return value;
};
