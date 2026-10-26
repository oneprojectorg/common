# NNNN. Enrol a voter before the first vote

Date: 2026-10-23

## Status

Proposed

## Context

The SMS voting memo registers a voter in two steps before the first
vote: an address, which the system turns into a council district, and
an attestation the voter affirms with AGREE. The web ballot has no
registration step today, and `submitVote` admits any member of the
decision.

A district ballot needs the voter's district. The address itself is
personal data that no later step reads: once it resolves to a boundary
the system has what it needs.

The registration is a conversation of several texts. Each text is one
run of a stateless dispatcher, so the pending step must live in the
database, not in a workflow's memory.

## Decision

We will store one row per voter and decision in
`decision_voter_enrolments`, keyed by `(process_instance_id,
profile_id)`.

The row holds `boundary_id`, the district the address resolved to, and
not the address. A decision with no boundaries enrols the voter with a
null boundary.

The row holds `attestation_hash`, the SHA-256 of the attestation text
the voter was sent, and `attested_at`. A hash binds the affirmation to
the exact words without storing them twice; the words live in the phase
rule.

`status` is the pending step of the conversation: `awaiting_address`,
`awaiting_agree`, `enrolled`. A check constraint refuses an `enrolled`
row without its hash and timestamp.

Whether a decision requires enrolment is a phase rule,
`voting.enrolment: { attestation, boundary }`, beside the ballot caps
(`voterBudget`, `maxVotesPerMember`). Absent means no enrolment step.
`boundary: true` requires the address to fall inside one of the
decision's boundaries.

## Consequences

- `submitVote` refuses a ballot from a voter without an `enrolled` row
  when the rule is set, on the web and over SMS alike.
- Deleting a decision deletes its enrolments. Deleting a boundary keeps
  the enrolment and clears its district.
- The address passes through the webhook and the Inngest event payload
  and is never written to a table. Inngest keeps event payloads for its
  retention period.
- Changing the attestation text after voters have affirmed it leaves
  their hashes pointing at the old words. The rule is written once per
  phase.
- Rejected: an address column. Nothing reads it after the boundary is
  known, and a stored address is a record to protect.
- Rejected: enrolment on `decisions_vote_submissions`. A voter is
  enrolled before any submission exists, and the nine readers of that
  table would each need a filter.
- Rejected: enrolment on `profile_users`. The attestation and the
  district belong to one decision, not to the voter's membership of its
  profile.
