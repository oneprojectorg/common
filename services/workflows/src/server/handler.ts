import { inngest } from '@op/events';
import { serve } from 'inngest/edge';

import * as functions from '../functions';

/**
 * Inngest's endpoint as a fetch handler — `(request: Request) => Promise<Response>`
 * — for the GET, POST and PUT the Inngest server sends.
 */
export const getHandler = () =>
  serve({
    client: inngest,
    functions: Object.values(functions),
  });
