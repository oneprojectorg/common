import {
  registerObservability,
  reportRequestError,
} from '@op/logging/instrumentation';
import { definePlugin } from 'nitro';

/**
 * Starts OpenTelemetry once per server process and reports every error the
 * server captures (a failed server route).
 */
export default definePlugin((nitroApp) => {
  registerObservability({ defaultServiceName: 'common-api' });

  nitroApp.hooks.hook('error', async (error, { event }) => {
    await reportRequestError({ error, request: event?.req });
  });
});
