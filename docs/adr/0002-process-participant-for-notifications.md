# 0002. Notification participants include members, submitters, and invited collaborators

Date: 2026-08-30

## Status

Accepted

## Context

Notifications about a decision process need a defined audience. Previously,
that audience was limited to process members.

That definition is incomplete for public processes. People can submit or
co-author proposals without becoming members. These contributors have a stake
in process updates, including phase transitions that affect their proposals.
Private processes do not have this gap because contributing requires
membership.

People who only visit a public process cannot be included because a visit
leaves no record.

## Decision

For notification purposes, a process **Participant** is:

> anyone who is a member of the process, or who submitted or was invited to
> collaborate on any of its proposals.

The following boundaries apply:

- **Participation lasts for the life of the process.** It applies across all
  phases, even when a participant's proposal does not advance.
- **Draft and deleted proposals do not confer participation.** A proposal must
  be submitted to bring its submitter and invited collaborators into the set.
- **Moderation does not remove participation.** Authors of hidden proposals
  remain participants.
- **Anonymity does not reduce participation.** Anonymous participants may be
  unreachable through channels for which they provided no address.
- **Participation is derived, not subscribed.** It is derived from membership
  and proposal records, with no separate follow or subscribe action. Visitors
  who leave no record are therefore excluded.

The definition is the same for public and private processes. In a private
process, it includes members and their invited collaborators. In a public
process, it also includes contributors who are not members.

All participants are eligible for the same notifications. This includes an
admin who triggered the notification.

## Consequences

- The definition applies retroactively to existing membership and proposal
  records. No subscription backfill is required.
- Visitors who never contribute remain unknown. Including them would require
  recording visits and revising this decision.
- The definition identifies people, not addresses. Each notification channel
  reaches the participants for whom it has the required contact information.
- There is no opt-out. Adding one is a separate future decision.
