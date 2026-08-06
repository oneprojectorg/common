# docs

Architecture documentation for the Common monorepo.

- [`plantuml/`](./plantuml/) — C4 model + entity-relationship diagrams, source of truth for the platform's architecture and data model. See that folder's README for `just lint` / `just render`.
- `architecture.md` — a rendered write-up that embeds the C4 diagrams above via [pandoc-plantuml-filter](https://pypi.org/project/pandoc-plantuml-filter/), so prose and diagrams ship as one document instead of drifting apart.
- `data-model.md` — same idea, for the entity-relationship diagrams.

## Rendering markdown docs

Markdown files in this folder can embed a diagram with a fenced code block that
`!include`s one of the `.puml` sources in `plantuml/` (paths are relative to
`docs/plantuml-images/`, the filter's scratch directory, hence the `../`):

````markdown
```{.plantuml plantuml-filename=my-diagram.svg}
!include ../plantuml/context.puml
```
````

Setup (once): `just docs-setup` — creates a `docs/.venv` (via `pipenv`) with `pandoc`'s
PlantUML filter installed. Requires `pandoc` and `plantuml` on `$PATH` (both already
required by [`plantuml/`](./plantuml/)).

- Render a single doc to HTML: `just docs-html` (defaults to `architecture.md`), or `just docs-html data-model.md` for another file
- Render `architecture.md` + `data-model.md` together as one document: `just docs-book` → `docs/system-design.html`
- Remove generated HTML/SVG output: `just docs-clean`

`docs/.venv`, `docs/plantuml-images/`, and the rendered `.html`/`.svg` output are all
git-ignored — only the Pipfile, its lockfile, and the markdown/`.puml` sources are checked in.
