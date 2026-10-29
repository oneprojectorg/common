# NNNN. Keep the draft ballot in its own table

Date: 2026-10-23

## Status

Proposed

## Context

A voter builds an SMS ballot over several texts: a code adds a pick,
LIST shows the picks, REMOVE and MOVE change them, DONE reviews, SUBMIT
casts. Each text is one run of a stateless dispatcher, so the picks
must live in the database between texts.

The web ballot has no draft today: the browser holds the picks and
`submitVote` writes `decisions_vote_submissions` once. Nine production
readers of that table (the tally, the results, the proposal metrics,
the list scope, the personal-data export, the vote-submitted
notification among them) treat every row as a cast ballot, and
`submitVote` enforces one row per voter and decision.

## Decision

We will store the ballot before submission in `decisions_vote_drafts`,
one row per voter and decision, keyed by
`(process_instance_id, profile_id)`, with its picks in
`decisions_vote_draft_proposals`.

Each pick is a row in `decisions_vote_draft_proposals`, keyed by
`(vote_draft_id, proposal_id)` with a nullable 1-based `rank` — the
shape of `decisions_vote_proposals`. A draft pick and a cast pick carry
the same row shape, so SUBMIT hands `submitVote` the picks in rank
order, and a deleted proposal leaves every draft by FK instead of by
validate-on-read. In an unranked phase `rank` is null and `created_at`
orders the picks.

The remaining budget is never stored. Each text recomputes it from the
picks' costs and the phase's `voterBudget`, so a cost edited after a
pick is charged at its current value, as `submitVote` charges it.

The channel state lives apart, in `decision_chat_sessions`: one
ephemeral row per voter and decision. `page_cursor` records where MORE
left off. `phone_number_id` records the line the voter last browsed
this decision on, so a bare MORE, INFO or code on a line follows a
decision chosen by slug on that same line and never one browsed on
another line. `reopened_at` records that CHANGE reopened the cast
ballot; a pick, REMOVE, MOVE or SUBMIT after a cast ballot is refused
until it is set. A session row is deletable without touching a draft;
the web ignores the table.

SUBMIT turns the draft into a submission and deletes the draft row and
its picks. The draft holds identity alone — instance, profile and the
pick rows — so a web draft uses the same rows unchanged.

## Consequences

- The draft is private to the voter: nothing reads the table but the
  dispatcher, and deleting the voter's profile or the decision deletes
  the draft.
- A pick that was valid when added can be refused at SUBMIT, because
  the budget and the eligibility are checked again there; the reply
  names the pick to remove.
- Rejected: a `status` column on `decisions_vote_submissions`. Every
  reader would need a `submitted` filter, and the one-ballot rule in
  `submitVote` would have to tell a draft from a cast ballot.
- Rejected: a `picks` jsonb array on the draft row. One write per text
  is cheaper than row updates, but a deleted proposal would linger as a
  dangling id until read-time validation, and the draft and the cast
  ballot would carry two formats for the same picks.
- Rejected: holding the picks in an Inngest workflow. A workflow that
  waits across texts holds the conversation in memory, and the memo's
  voter may take days between texts.
