# 0002. Model participant contact as a delivery channel

Date: 2026-08-25

## Status

Proposed

## Context

Email notification runs in four stages. A mutation emits a typed event from
`Events` in `services/events/src/types.ts`. Inngest routes it to one of 13
functions in `services/workflows`. Each function queries for addresses itself,
reading `profile_users`, `profiles`, or `users`. It then renders a React Email
template and sends through `OPNodemailer` or `OPBatchSend`.

The first two stages are channel-neutral. The last two are not. `BatchEmailItem`
in `services/emails` carries a subject and a React component, so every call site
fixes the channel. No table holds a participant's phone number.

Some participants reach a process by SMS, not by the web. A second channel must
carry outbound messages and inbound votes.

Two facts constrain the design.
`decisions_vote_submissions.submitted_by_profile_id` is `NOT NULL` and unique
per process instance, so a second identity produces a second vote. `Channels` in
`packages/common/src/realtime` already means realtime topic.

## Decision

We will keep the event and routing stages as they are. We will model a
participant's contact point as a delivery channel, between the routing stage and
the send.

- We will add `DeliveryChannel`, `DeliveryAddress`, and `Recipient` to
  `@op/common`. `DeliveryAddress` is a Zod discriminated union on `channel`.
- We will store addresses in a new `participant_channels` table, with a
  verification timestamp and an opt-out timestamp on each row. It becomes the
  one source a notification function reads.
- We will map an address to an account in a new `channel_identities` table. One
  person holds one profile across every channel.
- We will resolve recipients in one service, `resolveRecipients`. It replaces
  the query in each notification function.
- We will declare supported channels on each notification through a
  `NotificationTemplate` interface. `OutboundMessage` replaces `BatchEmailItem`
  at the send boundary.

## Consequences

A new channel becomes a new case in `OutboundMessage` and a new provider
adapter. It does not touch the 13 notification functions.

`resolveRecipients` returns a tagged union, so a dropped message names its
reason. It also forces one canonical address source, which settles the current
three-table split.

Every domain event must emit from the service layer. Seven sites in
`services/api/src/routers` emit today. One raises `content/submitted`, which
drives moderation, so an SMS entry point would skip review.

Each of the 13 notification functions needs a migration onto
`resolveRecipients`. Email behaviour must not change during that move. WhatsApp
cannot reuse the SMS case, because it rejects free text outside a 24-hour
session window.
