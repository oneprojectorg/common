---
title: Common Platform — Data Model
plantuml-format: svg
---

# Data Model

Entity-relationship diagrams (using PlantUML's [IE / crow's-foot notation](https://plantuml.com/ie-diagram))
for the core product tables, sourced directly from `services/db/schema/tables/*.sql.ts`
and the v2 relations in `services/db/relations.ts`. Rendered from
[`docs/plantuml/`](./plantuml/) so this document can't drift from what `just lint` checks.

These diagrams intentionally cover the core product domain, not the full schema — see
[`plantuml/README.md`](./plantuml/README.md) for what's out of scope and why.

## Identity & Access

```{.plantuml plantuml-filename=data-model-identity.svg}
!include ../plantuml/data-model-identity.puml
```

## Decision Process Domain

```{.plantuml plantuml-filename=data-model-decisions.svg}
!include ../plantuml/data-model-decisions.puml
```
