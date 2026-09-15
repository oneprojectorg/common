# 0005. Use TSDoc on public API contracts only

Date: 2026-09-15

## Status

Proposed

## Context

Comments are now mostly written by agents, and nothing governs them. The repo
holds 2,666 `/** */` blocks across 793 TS/TSX files, with no linter and no
convention beyond what an agent imitates from whatever it last read.

Quality is bimodal. Some blocks carry a contract nobody can infer from the
signature — `/** Omitted on surfaces that cannot clear it — only the editor
nags. */` on an optional prop. Others restate types the compiler already knows
("Skeleton for the proposal editor page") or narrate markup (`{/* Header */}`).

In scope: which declarations get a TSDoc block, which tags we allow, and what
counts as noise. Out of scope: prose inside function bodies, doc sites, i18n.

## Decision

A declaration gets a TSDoc block only when all three gates pass, in order.

**Gate 1 — it is public.** Reachable from a workspace's `package.json#exports`,
or a tRPC router procedure, or it crosses the client/server line (a zod schema,
a row type, or an envelope the other side consumes). The exports map is the
boundary; it is now a documentation boundary too. Not public: stop, no block.

**Gate 2 — it is a shape we document.** One of:

- a function, async function, or factory (`const f = (...) =>`),
- a type, interface, or enum,
- an exported const object (a config or option set),
- a zod schema or Drizzle row type (`typeof t.$inferSelect`).

Not a documented shape: a single-symbol re-export, a barrel `index.ts`, or a
const whose name and type already say everything. Not one of these: stop.

**Gate 3 — it says something the signature does not.** If deleting the block
loses nothing, do not write it.

Past all three, write one sentence: what a caller must know — the contract, the
why, the trap. Not what it does, line by line.

**Tags — only where the type cannot carry it.** The whitelist is `@param`
(non-obvious constraints, never restating a type), `@returns`, `@throws`
(required when a caller handles it; the `assert…Access` guards throw
`UnauthorizedError`), `@deprecated` (with the replacement and its ADR),
`@example`, `@see` (point at an ADR, not a person), `@internal`. Invent nothing
else.

**React components: no block — this overrides the gates.** A component gets
no TSDoc block even when it clears all three. The only scope boundary is
`@op/sense`, governed by `packages/sense/CLAUDE.md`, where JSDoc on composites
is product surface rendered into the Storybook props table. An agent asks one
question — *am I in `@op/sense`?* — not *is this component published?* This
ADR does not change that rule.

**Never a block** (regardless of gate): private helpers, sub-components, and
anything not exported; generated and non-shipping code —
`services/db/schema/tables/*.sql.ts`, `.next/types`, `*.stories.tsx`,
`*.test.ts(x)`, regenerated shadcn primitives.

**Rationale is `//`, contract is TSDoc.** See the envelope section of
`packages/common/src/utils/pagination.ts`: a `//` block for the reasoning,
one-line TSDoc for each exported symbol.

**Enforcement is one line in `AGENTS.md`, a toolkit skill, and a structural
gate.** The rule lands in `AGENTS.md` so an agent applies it while writing.
A skill will be added to the agent toolkit (`common-agent-toolkit`, sibling
of this repo) that applies the three gates to a file and reports the blocks
that should not be there. A CI check can
decide only the mechanical half — a block on a non-public symbol, or on a
component outside `@op/sense` — and fails only that. It cannot tell whether a
public comment is vacuous; that stays a review judgement.

## Consequences

- Hover docs become signal: what shows on an import is a contract someone meant
  to publish.
- An agent applies three yes/no gates instead of imitating local style.
- [TODO: Discuss] Every change to `package.json#exports` is a documentation act; a new export
  missing its block is a review comment.
- [TODO: Discuss] Existing noise stays until its file is touched. No big-bang deletion — churn
  on working code, and a stale comment and no comment mislead equally.
- [TODO: Discuss] "Public" is now load-bearing. If it ever needs to mean something else —
  exported-but-unstable, or internal-to-a-domain — that needs its own ADR.

## References

- [TSDoc](https://tsdoc.org/) — tag spec; we use a subset.
- [Microsoft TypeScript Community & Style Guide](https://github.com/microsoft/TypeScript/wiki/TypeScript-Style-Guide) — JSDoc on public members only.
- [ADR 0003](./0003-return-every-list-as-items-next.md) — implemented in
  `pagination.ts`, the file cited for the prose/TSDoc split.
