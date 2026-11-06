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
random 32-byte receipt and returns it once. Every value the database
keeps is derived from it the way ElectionGuard derives a ballot's values
from its nonce: HKDF-SHA-256 with the receipt as the keying material,
the process instance as the salt and a distinct label per use, so no
stored value gives away another and a receipt opens a ballot on one
instance only.

- `receipt_hash` is the lookup value the ballot is found under.
- `seal` is an HMAC over the picks under a second derived key, a
  reduced form of ElectionGuard's confirmation code. The receipt holder
  can tell whether the stored picks are still the ones they cast;
  someone who can write the table can change a ballot but not re-seal
  it. A broken seal is logged, not refused, because deleting a proposal
  legitimately removes its pick.

The web client keeps the receipt in the browser, keyed by the profile
that voted, and clears every receipt on sign-out. It passes the receipt
back only to read the ballot: `getBallot`, and the "my ballot" filter on
the proposal lists. `getVotingStatus` takes no receipt and says only
that the voter voted. A receipt travels in a POST body, never a URL:
the client sends any input that carries one as a POST, the server
refuses a receipt on any other method, and the query cache never
persists it.

Postgres stamps every row with the transaction that wrote it (`xmin`)
and appends rows to the heap in order, so a ballot written on its own
in the same transaction as its submission is linked to it by both.
Each cast therefore takes an advisory lock on the instance, deletes up
to 64 of its existing ballots chosen at random, and writes them again
with the new one in random order. The new ballot is then one of up to
65 rows that share a transaction id and a heap position, and the
mixing itself reveals nothing because the ballots it moves are chosen
at random.

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

- The mix leaves old row versions in the heap until vacuum, and in the
  WAL and any backup, where the version written by each transaction can
  be told apart. An observer who can diff the ballot table between two
  sparse votes sees which rows changed and so which one is new. The
  first ballot cast in an instance stands alone until the second. Full
  statement logging would record each ballot as it was written.
- A receipt is not receipt-free: its holder can prove what they voted
  for, so it could be used to sell or coerce a vote. We take that for
  the sake of a voter seeing their own ballot.
- `decisions_vote_drafts` links an SMS voter to their picks until SUBMIT
  deletes the draft.

Editing a cast ballot now needs the receipt to find the ballot, so any
design for revising a vote must start from this split.
