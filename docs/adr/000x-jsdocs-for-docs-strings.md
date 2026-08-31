# 000x. Use JSDoc conventions to structure doc comments

Date: 2026-08-31

## Status

Proposed

## Context

LLM coding agents write many of the doc comments in this repo. No
convention tells them what to write, so the comments differ in every
file. A reader cannot skim them, and a reviewer has no standard to
apply.

[JSDoc](https://jsdoc.app/) is a widely adopted standard for
documentation in JavaScript and TypeScript codebases. A comment opens
with `/**`, leads with a summary, and then tags the parts of the
signature:

```ts
/**
 * Move a proposal to `REJECTED`, for admins of its decision.
 *
 * A rejected proposal stops advancing through phases and stops being
 * votable, but it stays listed and readable, badged with its status.
 *
 * @param proposalId - The proposal to reject. A draft cannot be
 * rejected, because it has never been submitted.
 * @param user - The caller, who must be an admin of the decision.
 * @returns The proposal and the process instance it belongs to.
 * @throws ValidationError - When the proposal is still a draft.
 * @see {@link unrejectProposal} to undo it.
 */
export async function rejectProposal({
  proposalId,
  user,
}: {
  proposalId: string;
  user: User;
}): Promise<RejectProposalResult> {
```

JSDoc also allows a type in braces on most tags, such as `@param
{string} proposalId`. The example leaves it out.

Tools such as [Documentation.js](https://documentation.js.org/) read
these comments.

## Decision

We adopt the JSDoc conventions to structure a doc comment. We do not
adopt JSDoc as a type system. We do not use it to type the application
or its functions.

The tags organize the comment around the thing it documents:

- A summary describes the function or the object.
- One `@param` describes each parameter.
- `@returns` describes the result.
- `@throws` and `@see` cover the errors and the related code.

An agent then writes the same shape every time. A reader finds the same
part in the same place.

TypeScript declares every type in this codebase. Do not write a type in
a doc comment. Ignore a type that you find in one. Nothing checks it, so
it goes stale without a compiler error. The signature is the source of
truth for every type.

## Consequences

An agent has a convention to follow. Its doc comments become consistent,
and a reviewer can hold them to a standard.

The cost is enforcement. A reviewer has to apply the convention, and doc
comments still decay as the code changes.
