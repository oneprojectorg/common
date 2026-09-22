# Draft. Declare a budget's unit on the template field, not on each value

Date: 2026-09-21

## Status

Proposed

## Context

A proposal budget is modelled as money with an ISO currency code. Processes
need budgets in units that are not currencies, such as dots or points. A
budget is authored once, on the template, but stored in two places, so a unit
repeated on every value drifts from the template with nothing to say which is
right.

In scope: what a budget's unit is, where it is declared, and what a stored
value carries. Out of scope: rubric money criteria, which stay currency-only,
and display surfaces.

## Decision

- The unit is declared once, on the template's budget field. It is either a
  currency (ISO 4217 code) or a custom unit with a label.
- The unit is a sibling declaration next to the existing money format, not a
  new format.
- A stored value carries an amount, plus a currency only when the unit is a
  currency. Legacy values keep parsing unchanged, so there is no migration.
- A template with no declared unit resolves to the currency it already
  constrained, and to USD otherwise.
- Nothing converts between units. A stored currency that disagrees with the
  template's unit is unresolvable.

## Consequences

- One source of truth for a process's budget unit.
- Changing a template's unit reinterprets every existing amount in that
  process. We accept this as an admin action on the admin's own process; a
  ballot snapshot records the unit enforced when it was cast.
- Display code must resolve the unit through the template rather than read it
  off the value.
- Rubric money criteria diverge from proposal budgets until a rubric needs
  units too.
- A custom unit may have no symbol, so formatting falls back to its label.
