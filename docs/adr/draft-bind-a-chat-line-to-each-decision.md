# NNNN. Bind a chat line to each decision

Date: 2026-10-23

## Status

Proposed

## Context

A member votes over SMS in a conversation of five to ten texts: VOTE, a
few proposal codes, LIST, DONE, SUBMIT. Each text must land on one
decision. Common has one shared Twilio number and a stateless
dispatcher, so today every command carries the decision slug
(`SHOW columbus`). A ballot where every text repeats a slug is not one a
person types on a phone.

Twilio tells the webhook which number a text was sent to (`To`). If a
decision owns a number, the number names the decision and the slug
drops out.

Twilio can also route each number to its own webhook URL, which could
carry the decision in a query string. The signature covers the exact
URL, `twilio-configuration.md` rules out query strings, and a setting in
the Twilio Console is invisible to admins, untested and hard to reverse.

## Decision

We will store the binding as a row in `decision_chat_lines`: one Twilio
number, in E.164, bound to one decision instance. Both columns are
unique, so one number means one decision and a decision owns at most
one number. Deleting the decision deletes the row and frees the number.

How a number is bound is not part of this decision. The memo lists admin
features as a non-goal and says only that the number is printed on the
ballot guide. The row is written by an operator when the Twilio number is
added to the Messaging Service sender pool. An admin surface, if one is
wanted, is a later decision.

The dispatcher resolves `To` once per inbound text. A command with an
explicit slug keeps it; a command without one takes the line's decision.
Every reply on a line is sent from that number, so the member sees one
number per decision. The shared number behaves as before.

The feature is a _chat line_, not an SMS line: the word names the
purpose and survives a second channel.

## Consequences

- Bare VOTE, SHOW, PROPOSALS and the proposal codes work on a line. On
  the shared number a slug is still required.
- A decision needs a Twilio number of its own in the Messaging Service
  pool. That is a cost and an operations step per decision.
- One number maps to one decision. A programme that runs several
  decisions behind one number is not supported; its members use the
  shared number with a slug.
- The table is the source of truth for routing. A number bound in the
  Twilio Console but not in the table behaves as the shared number.
- Rejected: a webhook URL per number in the Twilio Console, for the
  reasons in Context.
- Rejected: `profile_chat_lines`, keyed by `profile_id` so one table
  could bind a number to an organization or a person later. Nothing
  binds a line from anywhere but a decision, and the dispatcher turns a
  line into a decision slug and nothing else; the generality was in the
  name only. Keyed by the instance, the table sits beside
  `decision_boundaries` and `decision_proposals`.
