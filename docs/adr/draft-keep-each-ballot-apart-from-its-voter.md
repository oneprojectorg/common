# NNNN. Keep each ballot apart from its voter

Date: 2026-11-06

## Status

Proposed

## Context

A cast ballot is a row in `decisions_vote_submissions`, keyed by the
voter's profile, with its picks in `decisions_vote_proposals` and copied
into `vote_data.selections`. The row also carries `validationSignature`,
which encodes the picks and the voter's id. Anyone who can query the
database can say who voted for what.

Two things still need the voter: one ballot per voter per decision, and
the voting-progress counts of who has voted. One thing needs the picks
and nothing else: the tally. The voter also expects to see their own
ballot after they cast it.

## Decision

We will store a ballot in two parts that nothing joins:

- `decisions_vote_submissions` records that a profile voted. It keeps the
  unique `(process_instance_id, submitted_by_profile_id)` index that
  allows one ballot per voter. `submitVote` no longer writes picks,
  selections or a signature to it.
- `decisions_vote_ballots` holds the picks' snapshot (budget, costs,
  ranks), with the picks as rows in `decisions_vote_ballot_proposals`. It
  has no profile, no submission id, and no foreign key to either.

`submitVote` writes both parts in one transaction, so a submission
exists exactly when its ballot does.

The voter keeps the only key to their ballot. `submitVote` makes a
random 32-byte receipt and returns it once. The ballot stores only the
receipt's SHA-256. The web client keeps the receipt in the browser and
passes it back to read the ballot (`getVotingStatus`, and the "my
ballot" filter on the proposal lists). Without a receipt, the voter sees
that they voted, but not what they voted for.

The ballot tables carry no timestamps, because when voting is sparse the
clock alone links a ballot to its submission:

- `cast_on` keeps the UTC day only.
- `position` keeps the order the picks were cast in, where
  `created_at` used to.
- The ballot id is a random v4 UUID, so its order says nothing about
  when it was cast.

A day can still identify a voter when few people vote that day. We
expect to drop `cast_on` later.

Ballots cast before this change keep their link to the voter. We will
not backfill or sever them. Every tally reads one union of the
anonymous picks and those legacy picks (`castPicks`), and a voter's own
legacy ballot is still found by their profile.

## Consequences

The database no longer says who voted for what on any ballot cast from
now on. The tally, results, selection pipeline and proposal lists count
both kinds of ballot through one query.

A voter who loses the receipt (on another device, or after clearing
site data) cannot see their ballot again, and nobody can recover it for
them. SMS voters get no receipt: texting it would put it in the
provider's message logs next to their phone number. The personal-data
export lists no picks for these ballots, since nothing ties them to the
person.

Some links remain outside the schema:

- tRPC sends queries as GET, so a receipt in a query input lands in the
  request URL, and any request log that keeps URLs and sessions together
  can join them. Sending these reads as POST would close it.
- The physical order of rows in Postgres, and the WAL, can line up a
  ballot with the submission written in the same transaction.
- `decisions_vote_drafts` links an SMS voter to their picks until SUBMIT
  deletes the draft.

Editing a cast ballot now needs the receipt to find the ballot, so any
design for revising a vote must start from this split.
