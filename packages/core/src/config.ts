import ImplPQueue from 'p-queue';
import colors from 'tailwindcss/colors';

export const APP_PORT = 3100;
export const API_PORT = 3300;
export const UI_WORKSHOP_PORT = 3600;
export const EMAILS_PORT = 3883;
export const ORM_VIZ_PORT = 3700;

export const APP_NAME = 'Common';
export const OP_EMAIL_NAME = 'Common';
export const OP_EMAIL_HELP = 'support@oneproject.org';

export const API_OPENAPI_PATH = `api/v1`;
export const API_TRPC_PTH = `api/v1/trpc`;
export const SUPABASE_PROJECT_ID = 'yrpfxbnidfyrzmmsrfic';

type ImplQueueConstructorParams = ConstructorParameters<typeof ImplPQueue>[0];

export const PQueue = (params?: ImplQueueConstructorParams) => {
  const { concurrency = 1, autoStart = true, ...rest } = params ?? {};

  return new ImplPQueue({ concurrency, autoStart, ...rest });
};

const VERCEL_GIT_BRANCH =
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF;

const isInStaging = VERCEL_GIT_BRANCH === 'staging';

const isInPreviewDeployment =
  process.env.VERCEL_ENV === 'preview' ||
  process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview';

// Check if running on a preview URL (vs custom domain)
// Prefer BRANCH_URL (branch-based) over URL (hash-based) for consistent preview URLs
const DEPLOYMENT_URL =
  process.env.VERCEL_BRANCH_URL ||
  process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL ||
  process.env.VERCEL_URL ||
  process.env.NEXT_PUBLIC_VERCEL_URL;
export const isOnPreviewAppDomain =
  DEPLOYMENT_URL?.endsWith('.vercel.app') ?? false;

// Extract the suffix after the project name for constructing other preview URLs
// Handles both formats:
// - "app-git-branch-oneproject.vercel.app" -> "-git-branch-oneproject.vercel.app"
// - "app-b9bcxaizg-oneproject.vercel.app" -> "-b9bcxaizg-oneproject.vercel.app"
const getPreviewUrlSuffix = (): string | null => {
  if (!DEPLOYMENT_URL || !isOnPreviewAppDomain) return null;
  const match = DEPLOYMENT_URL.match(/^[^-]+(-.+\.vercel\.app)$/);
  return match?.[1] ?? null;
};
const PREVIEW_URL_SUFFIX = getPreviewUrlSuffix();

const isInProductionOrStaging =
  process.env.NODE_ENV === 'production' &&
  (process.env.VERCEL_ENV === 'production' ||
    process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' ||
    isInStaging);

type TTarget = 'APP' | 'API' | 'WORKSHOP' | 'EMAILS';

type TOPURLConfig = (type: TTarget) => {
  TARGET: TTarget;
  ENV_URL: string;
  IS_PRODUCTION: boolean;
  IS_STAGING: boolean;
  IS_PREVIEW: boolean;
  IS_DEVELOPMENT: boolean;
  GIT_BRANCH: string | undefined;
  URLS: {
    STAGING: string;
    PRODUCTION: string;
    PREVIEW: string;
    DEVELOPMENT: string;
  };
  OPENAPI_URL: string;
  TRPC_URL: string;
};

export const OPURLConfig: TOPURLConfig = (type) => {
  // Include the . suffix for production if not APP
  const prodTarget = type === 'APP' ? '' : `${type.toLowerCase()}-`;
  const target = type.toLowerCase();
  let port = 0;

  switch (type) {
    case 'APP':
      port = APP_PORT;
      break;

    case 'API':
      port = API_PORT;
      break;

    case 'WORKSHOP':
      port = UI_WORKSHOP_PORT;
      break;

    case 'EMAILS':
      port = EMAILS_PORT;
      break;

    default:
      break;
  }

  // Construct preview URL: <target>-git-<branch>-<team>.vercel.app
  // Falls back to staging if not on a preview domain
  const previewUrl = PREVIEW_URL_SUFFIX
    ? `https://${target}${PREVIEW_URL_SUFFIX}`
    : `https://${target}-dev.oneproject.tech`;

  const urls = {
    STAGING: `https://${target}-dev.oneproject.tech`,
    PRODUCTION: `https://${prodTarget}common.oneproject.org`,
    PREVIEW: previewUrl,
    DEVELOPMENT: `http://localhost:${port}`,
  };

  const currentEnvUrl = isInProductionOrStaging
    ? isInStaging
      ? urls.STAGING // Staging
      : urls.PRODUCTION // Production
    : isInPreviewDeployment
      ? urls.PREVIEW // Preview
      : urls.DEVELOPMENT; // Local

  let apiURL = currentEnvUrl;

  if (type !== 'API') {
    apiURL = OPURLConfig('API').ENV_URL;
  }

  return {
    TARGET: type,
    ENV_URL: currentEnvUrl,
    IS_PRODUCTION: isInProductionOrStaging && !isInStaging,
    IS_STAGING: isInStaging,
    IS_PREVIEW: isInPreviewDeployment,
    IS_DEVELOPMENT: !isInProductionOrStaging && !isInPreviewDeployment,
    GIT_BRANCH: VERCEL_GIT_BRANCH,
    URLS: urls,
    OPENAPI_URL: `${apiURL}/${API_OPENAPI_PATH}`,
    TRPC_URL: `${apiURL}/${API_TRPC_PTH}`,
  };
};

export const urlMatcher = /oneproject\.(tech|org)$|-oneproject\.vercel\.app$/;
export const cookieOptionsDomain =
  VERCEL_GIT_BRANCH === 'main' ? '.oneproject.org' : '.oneproject.tech';
export const cookieDomains = [
  'oneproject.tech',
  '.oneproject.tech',
  '.oneproject.org',
  'api.oneproject.tech',
  'app.oneproject.tech',
  'web.oneproject.tech',
  'api-staging.oneproject.tech',
  'app-staging.oneproject.tech',
  'web-staging.oneproject.tech',
  'api-dev.oneproject.tech',
  'app-dev.oneproject.tech',
  'web-dev.oneproject.tech',
  'common.oneproject.org',
  'api-common.oneproject.org',
];

// PostHog config. Eventually to be moved to env vars
export const posthogUIHost = 'https://eu.posthog.com';

export const allowedEmailDomains = ['oneproject.org', 'team.oneproject.org'];

export const genericEmail = 'support@oneproject.org';

export const adminEmails = ['scott@oneproject.org'];

// NOTE: This allowlist will eventually be moved to the database
export const platformAdminEmails = new Set([
  'casimiro@oneproject.org',
  'nour@oneproject.org',
  'raphael@oneproject.org',
  'scott@oneproject.org',
  'zaana@oneproject.org',
  'valentino@oneproject.org',
]);

export const commonColors = colors.neutral;

export const version = '0.0.0';

const ascii = `
COMMON
`;

const style = () => {
  return 'color: #0f0;';
};

export const printNFO = () =>
  `console.log(\`${'%c'.concat(ascii)}\`, '${style()}')`;
