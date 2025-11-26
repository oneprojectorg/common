import { Centrifuge, Subscription, PublicationContext } from 'centrifuge';

export type { PublicationContext, Subscription };

export interface CentrifugoClientOptions {
  url: string;
  token: string;
  debug?: boolean;
}

export interface SubscriptionOptions {
  channel: string;
  onPublication: (ctx: PublicationContext) => void;
  onSubscribed?: () => void;
  onUnsubscribed?: () => void;
  onError?: (err: Error) => void;
}

/**
 * Creates a Centrifugo client instance
 */
export function createCentrifugoClient(
  options: CentrifugoClientOptions,
): Centrifuge {
  const client = new Centrifuge(options.url, {
    token: options.token,
    debug: options.debug ?? false,
  });

  return client;
}

/**
 * Subscribe to a channel and return the subscription
 */
export function subscribeToChannel(
  client: Centrifuge,
  options: SubscriptionOptions,
): Subscription {
  const sub = client.newSubscription(options.channel);

  sub.on('publication', options.onPublication);

  if (options.onSubscribed) {
    sub.on('subscribed', options.onSubscribed);
  }

  if (options.onUnsubscribed) {
    sub.on('unsubscribed', options.onUnsubscribed);
  }

  if (options.onError) {
    sub.on('error', (ctx) => {
      options.onError?.(new Error(ctx.error.message));
    });
  }

  sub.subscribe();

  return sub;
}

/**
 * Publish a message to a channel (client-side publish)
 * Note: Server must have publish: true in config
 */
export async function publishToChannel<T = unknown>(
  client: Centrifuge,
  channel: string,
  data: T,
): Promise<void> {
  await client.publish(channel, data);
}
