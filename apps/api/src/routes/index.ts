import { OPURLConfig } from '@op/core';
import { createFileRoute } from '@tanstack/react-router';

import { methodNotAllowed } from '../server/methodNotAllowed';

const useUrl = OPURLConfig('APP');

export const Route = createFileRoute('/')({
  server: {
    handlers: {
      GET: () => Response.redirect(new URL('/', useUrl.ENV_URL), 307),
      ANY: methodNotAllowed(['GET']),
    },
  },
});
