# Twilio configuration

Twilio delivers SMS for two features: phone confirmation at signup, and
notifications. [ADR 0004](adr/0004-support-multi-modal-notifications.md)
records the decision. This page lists each environment variable, where the
code reads it, and the webhook URLs to set in the Twilio Console.

## Environment variables

`.env.local.example` holds the template. `getSmsProvider` in
`packages/common/src/services/notification/provider.ts` reads the variables
and builds the Twilio client. GoTrue (Supabase Auth) reads three of them on
its own through `supabase/supabase-*.toml`.

| Variable                          | Prefix | Read by                                         | Purpose                                                                                                                                                                                    |
| --------------------------------- | ------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TWILIO_ACCOUNT_SID`              | `AC`   | `getSmsProvider`, GoTrue                        | Identifies the Twilio account. Empty turns SMS off: `getSmsProvider` returns `null` and callers skip the send.                                                                             |
| `TWILIO_AUTH_TOKEN`               | —      | `getSmsProvider`, GoTrue, both webhook handlers | Account-wide secret. Signs every inbound webhook, so it is required even when outbound calls use an API key.                                                                               |
| `TWILIO_API_KEY_SID`              | `SK`   | `getSmsProvider`                                | Optional scoped credential for outbound calls. Preferred over the auth token because you can revoke one key without rotating the account secret.                                           |
| `TWILIO_API_KEY_SECRET`           | —      | `getSmsProvider`                                | Secret for `TWILIO_API_KEY_SID`. Required when the SID is set.                                                                                                                             |
| `TWILIO_VERIFY_SERVICE_SID`       | `VA`   | GoTrue                                          | Verify service that confirms a phone number at signup. GoTrue sends the code, checks the reply, and issues the session. Twilio exempts Verify traffic from A2P 10DLC, so it works at once. |
| `TWILIO_MESSAGING_SERVICE_SID`    | `MG`   | `getSmsProvider`                                | Messaging service that sends notifications and the inbound-signup consent text. Needs an approved A2P 10DLC campaign; review takes 10–15 days.                                             |
| `SMS_PROVIDER`                    | —      | `getSmsProvider`                                | Set to `memory` to replace Twilio with an in-memory provider for tests. Leave unset elsewhere.                                                                                             |
| `NEXT_PUBLIC_AUTH_SMS_OTP_LENGTH` | —      | `@op/core` (`AUTH_SMS_OTP_LENGTH`)              | Digit count of the Verify code. Must match the Verify service's **Code length** (4–10, default 6). The email code has its own `NEXT_PUBLIC_AUTH_EMAIL_OTP_LENGTH`; the two can differ.     |

### Rules the resolver enforces

`getSmsProvider` throws a `CommonError` on a partial configuration instead of
turning SMS off. The rules:

1. `TWILIO_ACCOUNT_SID` empty: SMS is off. Nothing else is read.
2. `TWILIO_ACCOUNT_SID` set: one credential is required. Set
   `TWILIO_API_KEY_SID` with `TWILIO_API_KEY_SECRET`, or `TWILIO_AUTH_TOKEN`.
3. `TWILIO_API_KEY_SID` set without `TWILIO_API_KEY_SECRET`: error.
4. At least one of `TWILIO_VERIFY_SERVICE_SID` or
   `TWILIO_MESSAGING_SERVICE_SID` is required. Each switches on its own
   capability.

A Verify-only deployment is valid. It confirms phone numbers but cannot send
notifications. This is the signup-phase shape.

### Credential choice

Use an API key pair for outbound calls where you can. Keep
`TWILIO_AUTH_TOKEN` set in every environment that receives webhooks: Twilio
signs webhooks with the auth token only, and the handlers in
`services/api/src/notification/` return `503` when it is unset.

## Webhooks

Both webhook routes live in `apps/api`, so the host is the API host, not the
app host. Each handler validates `X-Twilio-Signature` against the request
URL. The URL in the Twilio Console must match the host and path exactly, with
no trailing slash and no query string, or every request fails with `401`.

| Environment | App host                  | API host                    |
| ----------- | ------------------------- | --------------------------- |
| Staging     | `app-dev.oneproject.tech` | `api-dev.oneproject.tech`   |
| Production  | `common.oneproject.org`   | `api-common.oneproject.org` |
| Local       | `localhost:3100`          | `localhost:3101`            |

`packages/core/src/config.ts` derives these hosts.

### Routes

| Twilio Console setting                  | Path                                   | Handler                             |
| --------------------------------------- | -------------------------------------- | ----------------------------------- |
| Messaging → "A message comes in" (POST) | `/api/v1/notifications/twilio/inbound` | `handleTwilioInboundWebhookRequest` |
| Messaging → status callback (POST)      | `/api/v1/notifications/twilio/status`  | `handleTwilioStatusWebhookRequest`  |

For staging, the full URLs are:

```
https://api-dev.oneproject.tech/api/v1/notifications/twilio/inbound
https://api-dev.oneproject.tech/api/v1/notifications/twilio/status
```

Set the inbound URL on the Messaging Service, not on a bare phone number.
A2P 10DLC requires a Messaging Service, and sticky sender and geomatch are
Messaging Service features.

The inbound handler publishes an `smsInboundReceived` Inngest event keyed on
`MessageSid`, so Twilio retries of one message do not start two runs. The
status handler replies with empty TwiML.

## Webhook failure logs

Both handlers log through `@op/logging`, which exports OpenTelemetry log
records to PostHog (`OTEL_EXPORTER_OTLP_ENDPOINT`, see `.env.local.example`).
Every refused request writes one record before it returns. In PostHog, open
**Logs**, filter on the service name (`OTEL_SERVICE_NAME`, `common` by
default), and search for the message prefix `Twilio`.

| HTTP status | Level   | Message                                                          | Cause                                                                                 | Fix                                                                                      |
| ----------- | ------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `503`       | `error` | `Twilio inbound webhook received but TWILIO_AUTH_TOKEN is unset` | The API deployment has no `TWILIO_AUTH_TOKEN`.                                        | Set the variable in the Vercel project env for that environment.                         |
| `401`       | `warn`  | `Twilio inbound webhook missing X-Twilio-Signature`              | The request did not come from Twilio.                                                 | Expected for probes. Check the Console URL if Twilio itself triggers it.                 |
| `401`       | `warn`  | `Twilio inbound webhook signature verification failed`           | The Console URL does not match the request URL, or the token is from another account. | Compare the Console URL with the Routes table, character for character. Check the token. |
| `400`       | `warn`  | `Twilio inbound webhook missing MessageSid`                      | The body is not a Twilio message payload.                                             | Check that the URL is set on a Messaging Service, not another Twilio product.            |
| `500`       | `error` | `Twilio inbound webhook unhandled error`                         | Inngest refused the event, or an unexpected throw.                                    | Open the record; the `error` attribute holds the cause.                                  |

The status webhook writes the same records with the prefix
`Twilio status webhook`, except the `400` case, which it does not check.

A successful request writes an `info` record: `Twilio inbound message received`
or `Twilio message status callback`, each with the `messageSid`. Absence of
that record after a text means Twilio never reached the handler.

The Twilio Console keeps its own log. **Monitor → Logs → Errors** lists every
webhook that returned a non-2xx status, with the status code and the response
body. Error `11200` means Twilio could not reach the URL at all; check the
host before checking our logs.

## Feature flags

Two PostHog flags gate the phone features. `sms-login` needs only Verify.
`sms-signup` sends through the Messaging Service, so it stays off until the
A2P campaign is approved.

| Flag         | Gates                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| `sms-login`  | The phone option in `LoginPanel` and `JoinAccountModal`.                                                         |
| `sms-signup` | `handleUnknownSmsSignup`: an unknown number that texts the Messaging Service gets a consent text and an account. |

## Local development

Local work needs no Twilio account. `supabase/supabase-dev.toml` lists test
numbers under `[auth.sms.test_otp]`. A listed number skips the provider and
accepts only its listed code. Sign in as `+1 500 555 0006` with the code
`123456`. The range is reserved by Twilio for testing, so no real line can
collide with it.

GoTrue never autoconfirms a phone. `smsAutoconfirm.test.ts` in `services/api`
fails if that is turned back on.
