/**
 * SMS delivery and phone-number confirmation.
 *
 * Import `SmsProvider` to depend on a vendor without naming one. Call
 * `getSmsProvider` at the edge to resolve the configured vendor, and pass the
 * result into the service that sends. Call `parsePhoneNumber` on any number
 * that arrives from outside.
 *
 * `createTwilioProvider` and `TwilioRestClient` are exported for tests and for
 * `getSmsProvider`. A service should not name either one.
 */
export * from './provider';
export * from './providers/twilio';
export * from './schemas';
export * from './types';
