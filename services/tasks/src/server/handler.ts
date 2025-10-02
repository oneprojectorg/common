import { serve } from 'inngest/next';

import { inngest } from '../client/';
import * as functions from '../functions';

export const getHandler = () =>
  serve({
    client: inngest,
    functions: Object.values(functions),
  });
