import { inngest } from '@op/events';
import { serve } from 'inngest/next';

import * as functions from '../functions';

export const getHandler = () =>
  serve({
    client: inngest,
    functions: Object.values(functions),
  });
