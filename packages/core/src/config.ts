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

const isInVercelPreview =
  process.env.VERCEL_ENV === 'preview' ||
  process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview';

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

  const urls = {
    STAGING: `https://${target}-dev.oneproject.tech`,
    PRODUCTION: `https://${prodTarget}common.oneproject.org`,
    // TODO: gotta figure preview out properly
    // <project-name>-git-<branch-name>-<scope-slug>.vercel.app
    PREVIEW: `https://${target}-dev.oneproject.tech`,
    DEVELOPMENT: `http://localhost:${port}`,
  };

  const currentEnvUrl = isInProductionOrStaging
    ? isInStaging
      ? urls.STAGING // Staging
      : urls.PRODUCTION // Production
    : VERCEL_GIT_BRANCH
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
    IS_PREVIEW: isInVercelPreview,
    IS_DEVELOPMENT: !isInProductionOrStaging && !isInVercelPreview,
    GIT_BRANCH: VERCEL_GIT_BRANCH,
    URLS: urls,
    OPENAPI_URL: `${apiURL}/${API_OPENAPI_PATH}`,
    TRPC_URL: `${apiURL}/${API_TRPC_PTH}`,
  };
};

export const urlMatcher = /oneproject\.(tech|org)$/;
export const cookieOptionsDomain = '.oneproject.tech';
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
  '.supabase.co',
  'supabase.co',
];

export const allowedEmailDomains = ['oneproject.org', 'team.oneproject.org'];

export const genericEmail = 'support@oneproject.org';

export const adminEmails = ['scott@oneproject.org'];

export const commonColors = colors.neutral;

export const version = '0.0.0';

const ascii = `
                                                                  
                                                                  
 ______    ______    __    __    __    __    ______    __   __    
/\  ___\  /\  __ \  /\ "-./  \  /\ "-./  \  /\  __ \  /\ "-.\ \   
\ \ \____ \ \ \/\ \ \ \ \-./\ \ \ \ \-./\ \ \ \ \/\ \ \ \ \-.  \  
 \ \_____\ \ \_____\ \ \_\ \ \_\ \ \_\ \ \_\ \ \_____\ \ \_\\"\_\ 
  \/_____/  \/_____/  \/_/  \/_/  \/_/  \/_/  \/_____/  \/_/ \/_/ 
                                                      v${version} 
                                                                  
                                                                  
`;

const style = () => {
  return 'color: #0f0;';
};

export const printNFO = () =>
  `console.log(\`${'%c'.concat(ascii)}\`, '${style()}')`;
