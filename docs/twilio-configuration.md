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
event carries the sender (`from`), the number texted (`to`), the
`MessageSid`, the parsed command (`keyword`, `argument`), the digits as a
signup `code` when the text is only digits, and the message text (`body`).
The text is on the event because a street address and a list of proposal
codes are free text; Inngest keeps event payloads for its retention period,
and nothing writes the text to a table. Both handlers reply with empty TwiML
(`<Response></Response>`, `text/xml`), which Twilio expects from a message
webhook.

A carrier keyword — STOP, START or HELP and their aliases, as Twilio lists
them — is acknowledged and not published. Twilio answers those itself and,
after STOP, refuses every later send to the number with error 21610, so a
reply from us would be a second help text or a doomed send. With Advanced
Opt-Out on the Messaging Service the request carries `OptOutType`; without
it the handler recognises the keyword from the body.

### Commands

`handleSMSCommand` in `services/workflows` answers a confirmed number. A
keyword is matched case-insensitively at the start of the text; anything
else is free text. A decision is named by its slug, or by the line the text
was sent to (see Decision lines). The keywords live in
`packages/core/src/sms.ts`; the dispatcher is a `switch` over them, so a
keyword without a handler fails the typecheck.

| Text                        | Reply                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `JOIN`                      | On a known number: you already have an account. On an unknown number: `handleUnknownSmsSignup` sends the consent text and creates the account. |
| `SHOW`                      | The decisions the member belongs to; on a line, that decision's phase, voting state and ballot size.                                        |
| `SHOW <slug>`               | One decision's phase, voting state and ballot size.                                                                                        |
| `VOTE [<slug>]`             | Starts registration when the voting phase has `voting.enrolment`: asks for the address. Without the rule: no registration is needed.        |
| a street address            | While a registration waits for it: confirms the district and sends the attestation, or says the address was not found or is outside.      |
| `AGREE`                     | Affirms the attestation that was sent; the voter is registered.                                                                             |
| `PROPOSALS [<slug>]`        | The first five proposals of the voter's district ballot with codes and costs.                                                             |
| `MORE`                      | The next five, from where PROPOSALS left off.                                                                                                |
| `INFO <code>`               | One proposal's title, cost and summary.                                                                                                     |
| `<code>` or `<code> <code>` | Adds each proposal to the draft ballot in order and says what is left of the budget; a pick that does not fit is refused with the make-room reply. |
| `LIST`                      | The draft ballot in rank order with the allocated and unspent amounts.                                                                      |
| `REMOVE <code>`             | Takes a pick off the draft.                                                                                                                 |
| `MOVE <code> <position>`    | Reorders a pick; order is rank.                                                                                                             |
| `DONE`                      | The full ballot, the ranking note and the SUBMIT prompt.                                                                                     |
| `SUBMIT`                    | Casts the ballot through `submitVote`, or revises it after CHANGE through `reviseVote`. A second SUBMIT says the ballot is already in.      |
| `CHANGE`                    | Reopens a cast ballot as a draft while the phase has `voting.edit`. Until then a code, LIST, DONE, REMOVE or MOVE after SUBMIT says to text CHANGE. |
| anything else               | The help text.                                                                                                                              |

STOP, START and HELP never reach the dispatcher; Twilio answers them (see
above). Digits from a number with no account are a signup code and belong to
`handleUnknownSmsSignup`; digits from a confirmed number are proposal codes.

### Decision lines

A decision can own a Twilio number. The binding is a row in
`decision_chat_lines` (`process_instance_id`, `phone_number` in E.164), and
nothing in the product writes it yet: an operator inserts it when the number
is added to the Messaging Service sender pool. On a line, SHOW, VOTE,
PROPOSALS and the ballot keywords need no slug, and every reply is sent from
that number. A number bound in the Twilio Console but not in the table
behaves as the shared number.

```sql
insert into decision_chat_lines (process_instance_id, phone_number)
values ('<decision_process_instances.id>', '+16145550130');
```

### Ballot guide

Each submitted proposal has a short code (`decision_proposals.short_code`,
from 101 per decision), the number a voter texts. The CSV from
`decision.export` carries it in the `Code` column beside `Proposal ID`, so
the printed ballot guide can be produced from the existing export.

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

## Code send failures

Phone sign-in asks GoTrue for a code, and GoTrue asks Twilio Verify. When
Verify refuses, GoTrue answers `422` with the code `sms_send_failed` and a
message that relays Twilio's own: `Error sending sms OTP to provider:
<Twilio message> More information: https://www.twilio.com/docs/errors/<code>`.

The browser logs one record, `GoTrue refused to send a code`, from
`apps/app/src/hooks/phoneAuth/supabaseOtp.ts`. It reaches PostHog **Logs**
under the service `common-web` with these attributes, and Error Tracking as
an exception with the same values as event properties:

| Attribute          | Value                                                                                                                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `code`             | GoTrue's code, `sms_send_failed` for a provider refusal.                                                                                                                                                          |
| `status`           | GoTrue's HTTP status, `422` for a provider refusal.                                                                                                                                                               |
| `twilioCode`       | The number at the end of Twilio's error URL. Absent when Twilio was not the cause.                                                                                                                                |
| `twilioAccountSid` | The account Twilio was called with, as `AC…1234` (type and last four characters). Present when Twilio's message names it. Compare with the Console to confirm a rotation.                                         |
| `twilioServiceSid` | The Verify or Messaging service, as `VA…1234` or `MG…1234`. Present when Twilio's message names it.                                                                                                               |
| `diagnostic`       | GoTrue's message with every phone number replaced by `[phone]` and every Twilio SID by `[twilio-sid]`. Twilio echoes the number it refused and names the account and service, so the raw message is never logged. |

Look up `twilioCode` at `https://www.twilio.com/docs/errors/<code>`. The
ones Verify returns most:

| `twilioCode` | Cause                                            | Fix                                                                                         |
| ------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `20003`      | The Account SID and Auth Token do not match.     | Check `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` in the Supabase project's auth settings. |
| `20404`      | No Verify service has that SID.                  | Check `TWILIO_VERIFY_SERVICE_SID` is the `VA...` SID, not the `MG...` one.                  |
| `60200`      | Twilio rejected the number as invalid.           | The number failed E.164 validation on Twilio's side; check `normalizePhoneNumber`.          |
| `60203`      | The number hit Verify's send-attempt cap.        | Expected. The app reads it as a throttle and tells the person to wait.                      |
| `60205`      | The number is a landline and cannot receive SMS. | Nothing to fix; the person needs a mobile number.                                           |
| `60605`      | Geographic permissions block that country.       | Twilio Console → Messaging → Settings → Geo permissions.                                    |
| `60410`      | Twilio's fraud guard blocked the number.         | Twilio Console → Verify → Fraud Guard.                                                      |

GoTrue's own throttle is separate: `over_sms_send_rate_limit` with no
`twilioCode`, from `[auth.sms] max_frequency` and `[auth.rate_limit] sms_sent`.

A local stack shows the same message in the auth container:
`docker logs supabase_auth_common 2>&1 | grep -i twilio`. A number listed
under `[auth.sms.test_otp]` never reaches Twilio, so it cannot produce this
error; any other number needs real credentials in `.env.local`.

## Feature flags

Three PostHog flags gate the phone features. `sms-login` needs only Verify.
`sms-signup` and `sms-commands` send through the Messaging Service, so they
stay off until the A2P campaign is approved.

| Flag           | Gates                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| `sms-login`    | The phone option in `LoginPanel` and `JoinAccountModal`.                                                         |
| `sms-signup`   | `handleUnknownSmsSignup`: an unknown number that texts the Messaging Service gets a consent text and an account. |
| `sms-commands` | `handleSMSCommand`: a confirmed number that texts a command, a proposal code or anything else gets a reply (see Commands). |

## Local development

Local work needs no Twilio account. `supabase/supabase-dev.toml` lists test
numbers under `[auth.sms.test_otp]`. A listed number skips the provider and
accepts only its listed code. Sign in as `+1 500 555 0006` with the code
`123456`. The range is reserved by Twilio for testing, so no real line can
collide with it.

GoTrue never autoconfirms a phone. `smsAutoconfirm.test.ts` in `services/api`
fails if that is turned back on.

### Manual test through ngrok

A text conversation against a local checkout needs a Twilio account with a
Messaging Service, an approved A2P campaign, and one number in its sender
pool to bind as a decision line. Nothing here starts or stops the dev
servers. The app runs on `:3100`. The API port depends on how it was
started: `pnpm docker:dev` publishes it on `:3101`, `pnpm -C apps/api dev`
(what the root `pnpm dev` runs) listens on `:3300`. The steps below use
`<api port>` for it.

The command handlers run in Inngest, so the webhook alone sends nothing
back. `pnpm w:workflows dev` starts the Inngest dev server on
`http://localhost:8288`; `services/workflows/inngest.json` points it at
`http://localhost:3300/api/v1/workflows`, so under `pnpm docker:dev` pass
`-u http://localhost:3101/api/v1/workflows`. The address step calls Google
Places and throws without `GOOGLE_MAPS_API_KEY` in `.env.local`; set
`SMS_GEOCODE_STUB=<lat>,<lng>` instead to resolve every address to one
point outside production.

1. Tunnel the API: `ngrok http <api port>`. Copy the `https://…ngrok…` host.
2. In the Twilio Console, on the Messaging Service, set "A message comes in"
   (POST) to `https://<ngrok host>/api/v1/notifications/twilio/inbound` —
   exact path, no trailing slash, no query string. Outside production the
   route rebuilds the signed URL from `x-forwarded-proto` and
   `x-forwarded-host`, so the signature check passes through the tunnel; in
   production it trusts only the request URL.
3. The `sms-signup` and `sms-commands` flags are forced on when
   `NODE_ENV=development` (`areFeatureFlagsForcedOn` in `@op/analytics`),
   so a `next dev` server needs nothing in PostHog. A production build
   reads the flags.
4. Publish a decision whose voting phase has `voting.submit: true`, a
   `voterBudget`, `ranked: true`, `edit: true` if CHANGE is to be tested, and
   `voting.enrolment: { attestation, boundary }` if registration is. Import
   boundaries with `packages/common/src/scripts/importBoundaries.sql` (paste
   the GeoJSON, set `name_property` and the decision's `profile_id`); it
   creates the matching proposal category for each. Submit proposals whose
   pins fall inside them; each submitted proposal gets a short code.
5. Bind the line: insert the `decision_chat_lines` row (see Decision lines)
   for the decision's `decision_process_instances.id` and the pool number.
6. From a phone, text the line. The expected conversation, with a
   `voterBudget` of 1,000,000 and the memo's example titles:

| You text                 | Reply                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `JOIN`                   | The consent text, then a code to confirm the number; reply with the code. `JOIN` takes no argument on either number.                      |
| `SHOW`                   | `"<decision>" (<slug>): Voting phase, voting open, N proposals.`                                                                           |
| `VOTE`                   | `Welcome to "<decision>". Two quick steps to register: your address, then a short affirmation. No ID needed. What's your address?`         |
| `375 S High St, …`       | `That's District 5. Reply AGREE to affirm: "<attestation>"`                                                                                 |
| `AGREE`                  | `You're registered. You have $1,000,000 for District 5 proposals.`                                                                           |
| `PROPOSALS`              | `District 5 has N proposals. First 5:` then `101 <title> ($85,000)` … and `Reply MORE for the rest, or INFO plus a code.`                   |
| `MORE`                   | `Next 5:` …                                                                                                                                 |
| `INFO 101`               | `101 "<title>" ($85,000)` and the summary.                                                                                                  |
| `101`                    | `Pick 1: "<title>" ($85,000). $915,000 left. Text another code, LIST to see your ballot, or DONE to review.`                                |
| `102 103`                | `Pick 2: … Pick 3: … $<left> left.`                                                                                                        |
| a code that does not fit | `"<title>" costs $…. You have $… left. Reply REMOVE plus a code to make room, or pick a smaller project.`                                    |
| `LIST`                   | `Your District 5 ballot:` numbered picks, `$… allocated, $… unspent.`                                                                        |
| `REMOVE 103` / `MOVE 102 1` | `Removed "<title>". $… left.` / `"<title>" is now pick 1.`                                                                                |
| `DONE`                   | The ballot, the ranking note and `Reply SUBMIT to cast your ballot.`                                                                         |
| `SUBMIT`                 | `Your ballot is in. One ballot per person. However, your vote is never public.`                                                             |
| `SUBMIT` again           | `Your ballot is already in. One ballot per person.`                                                                                         |
| `CHANGE`                 | `Your ballot is open for changes…` and the ballot (needs `voting.edit`); then codes, REMOVE, MOVE and `SUBMIT` → `Your ballot is updated…` |

On the shared number the same conversation works with a slug: `SHOW <slug>`,
`VOTE <slug>`, `PROPOSALS <slug>`. The codes, LIST, DONE, SUBMIT and CHANGE
follow the draft you touched last, and the ballot you cast last once no
draft remains; send `PROPOSALS <slug>` to choose a decision. On a line they
follow that line's decision, or a decision you chose by slug on that same
line; a draft started on another line never takes over.

Read back the result with the voter's profile: one row in
`decisions_vote_submissions`, its `decisions_vote_proposals` rows in pick
order, and no row left in `decision_ballot_drafts`.
