import {
  getModerationProvider,
  getModerationProviderName,
  getModerationWebhookSecret,
  handleModerationWebhook,
  recordModerationWebhookDelivery,
} from '@op/common';

export interface ModerationWebhookRequest {
  rawBody: string;
  headers: Record<string, string>;
  providedSecret?: string;
}

/**
 * Wires the route's webhook handler with the configured provider, shared
 * secret, and the inbox-backed delivery recorder. The HTTP route (apps/api)
 * reads the raw request and delegates here, keeping vendor/DB logic in the API
 * layer. Parsing and verdict application happen asynchronously in the
 * `dispatchModerationWebhookDelivery` + `applyModerationVerdict` workflows so
 * this call is constant-time wrt how many verdicts a delivery carries.
 */
export const handleModerationWebhookRequest = (
  request: ModerationWebhookRequest,
) =>
  handleModerationWebhook(request, {
    expectedSecret: getModerationWebhookSecret(),
    provider: getModerationProvider(),
    providerName: getModerationProviderName() ?? undefined,
    recordDelivery: async (input) => {
      await recordModerationWebhookDelivery(input);
    },
  });
