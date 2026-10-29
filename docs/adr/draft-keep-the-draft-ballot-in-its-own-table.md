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
`(process_instance_id, profile_id)`.

`picks` is an ordered JSON array of proposal ids. Position is rank, so
MOVE and REMOVE are one row update, and SUBMIT passes the array to
`submitVote` in that order.

The remaining budget is never stored. Each text recomputes it from the
picks' costs and the phase's `voterBudget`, so a cost edited after a
pick is charged at its current value, as `submitVote` charges it.

`page_cursor` records where MORE left off while the voter browses, and
`chat_line_id` the decision line the voter last browsed this decision
on, so a bare MORE, INFO or code on a line follows a decision chosen by
slug on that same line and never one browsed on another line. These two
are the columns shaped by the text channel; the web ignores them.

SUBMIT turns the draft into a submission and deletes the row. After
that, a text that browses the ballot makes a new row to hold its cursor,
so a row alone does not mean the voter is editing a cast ballot.
`reopened_at` records that CHANGE reopened the cast ballot; a pick,
REMOVE, MOVE or SUBMIT after a cast ballot is refused until it is set. A
submission is the same ballot one state later, so a web draft can use
the same row when the web needs one.

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
- Rejected: holding the picks in an Inngest workflow. A workflow that
  waits across texts holds the conversation in memory, and the memo's
  voter may take days between texts.
