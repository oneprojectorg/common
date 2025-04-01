
import Cookies from 'js-cookie';

import { cookieDomains, OPURLConfig, SUPABASE_PROJECT_ID } from '@op/core';

const useURL = OPURLConfig('APP');

const cookiesToRemove = [
  `sb-${SUPABASE_PROJECT_ID}-auth-token-code-verifier`,
  `sb-${SUPABASE_PROJECT_ID}-auth-token`,
];

let domains: string[] = [];

if (!useURL.IS_DEVELOPMENT) {
  domains = cookieDomains;
}
else {
  domains = ['localhost'];
}

const nukeCookies = () => {
  for (const cookie of cookiesToRemove) {
    // Just to be sure
    Cookies.remove(cookie);

    // Clean up cookies for all domains
    for (const domain of domains) {
      // For chrome
      Cookies.remove(cookie, { domain });
      // For firefox https://stackoverflow.com/a/67335269
      Cookies.remove(cookie, { path: '/', domain });
    }
  }
};

export default nukeCookies;
