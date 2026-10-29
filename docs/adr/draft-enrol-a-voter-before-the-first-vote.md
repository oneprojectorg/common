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

The row holds `taxonomy_term_id`, the district category the address
resolved to, and not the address. The boundary is the lookup step, not
the stored fact: the address falls inside a boundary, and the boundary
carries its term (`decision_boundaries.taxonomy_term_id`). A decision
with no boundaries enrols the voter with a null term, and a
non-geographic grouping is a term like any other (`taxonomy_terms`
carries a `facet` for that).

The row holds `enrolled_at`, stamped when the voter affirms the
attestation with AGREE. The affirmation is a bare timestamp, the shape
of `users.tosAcceptedOn`; the attestation words live in the phase rule.

Status is derived from nullability, not stored: no row is not started,
a null `taxonomy_term_id` awaits an address, a term with a null
`enrolled_at` awaits AGREE, and a set `enrolled_at` is enrolled. There
is no check constraint: an attestation-only decision enrols with a
null term.

Whether a decision requires enrolment is a phase rule,
`voting.enrolment: { attestation, boundary }`, beside the ballot caps
(`voterBudget`, `maxVotesPerMember`). Absent means no enrolment step.
`boundary: true` requires the address to fall inside one of the
decision's boundaries.

## Consequences

- `submitVote` refuses a ballot from a voter whose row has no
  `enrolled_at` when the rule is set, on the web and over SMS alike.
- Deleting a decision deletes its enrolments. Deleting the category
  term keeps the enrolment and clears its district.
- The address passes through the webhook and the Inngest event payload
  and is never written to a table. Inngest keeps event payloads for its
  retention period.
- The row does not say which attestation words were affirmed. A
  verifications table, or a shared acceptances table that also absorbs
  `users.tosAcceptedOn`, can add that later; both are deferred.
- Rejected: a `status` enum and an `attestation_hash` with its check.
  The enum repeats what nullability already says, and the hash is a
  verification record this table does not need yet.
- Rejected: an address column. Nothing reads it after the district is
  known, and a stored address is a record to protect.
- Rejected: enrolment on `decisions_vote_submissions`. A voter is
  enrolled before any submission exists, and the nine readers of that
  table would each need a filter.
- Rejected: enrolment on `profile_users`. The attestation and the
  district belong to one decision, not to the voter's membership of its
  profile.
