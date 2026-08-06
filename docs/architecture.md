---
title: Common Platform — Architecture
plantuml-format: svg
---

# Architecture

C4 model diagrams for the Common Platform. Each diagram below is rendered
from its source of truth in [`docs/plantuml/`](./plantuml/), included
directly so this document never drifts from the diagrams used by
`just lint` / `just render`.

## System Context

```{.plantuml plantuml-filename=architecture-context.svg}
!include ../plantuml/context.puml
```

## Containers

```{.plantuml plantuml-filename=architecture-container.svg}
!include ../plantuml/container.puml
```

## API Host Components

```{.plantuml plantuml-filename=architecture-api-components.svg}
!include ../plantuml/api-components.puml
```
