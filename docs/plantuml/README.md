# Architecture diagrams

[C4 model](https://c4model.com/) diagrams for the Common Platform, written in [PlantUML](https://plantuml.com/) using its bundled C4-PlantUML stdlib (`!include <C4/C4_*>` — no network access needed to lint or render).

- `context.puml` — C4 level 1: the platform, its users, and the external systems it talks to.
- `container.puml` — C4 level 2: the deployable containers inside the platform (`apps/app`, `apps/api`) and the infrastructure they depend on.
- `api-components.puml` — C4 level 3: the packages/services composing the API Host container.

Data model ([IE / entity-relationship notation](https://plantuml.com/ie-diagram)), sourced from `services/db/schema/tables/*.sql.ts` and `services/db/relations.ts`:

- `data-model-identity.puml` — auth users, app users, profiles, organizations, and access roles.
- `data-model-decisions.puml` — the decision process domain: processes, instances, proposals, reviews, category-scoped reviewers, votes, and results.

These two intentionally cover the core product tables, not the full ~30-table schema — state-machine bookkeeping (`processTransitions`, `decisionTransitionProposals`), geo-boundaries, moderation, storage, and taxonomy/location tables are left for a future diagram if/when they need documenting.

## Working with these diagrams

- Lint (syntax-check, no images produced): `just lint`
- Render all diagrams to SVG next to their source: `just render`
- Remove generated SVG output: `just clean`

Diagrams should stay grounded in what's verifiably true of the codebase (real package names, real deployables per `docker-compose.dev.yml` / each workspace's `package.json`) — check the code before adding a new box, don't infer architecture from naming alone.

To embed these diagrams inline in a prose document instead of viewing them standalone, see [`../README.md`](../README.md) (`../architecture.md` for an example).
