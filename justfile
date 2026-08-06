plantuml_dir := "docs/plantuml"
docs_dir := "docs"
docs_pipfile := "docs/Pipfile"
tmpdir := env_var_or_default("TMPDIR", "/tmp")

# List available recipes
default:
    @just --list

# Validate PlantUML diagram syntax without generating images
lint:
    plantuml --check-syntax --stop-on-error "{{plantuml_dir}}/**/*.puml"

# Render all diagrams to SVG next to their sources (for local review)
render:
    JAVA_TOOL_OPTIONS="-Djava.io.tmpdir={{tmpdir}}" plantuml -tsvg "{{plantuml_dir}}/**/*.puml"

# Remove generated PlantUML SVG output
clean:
    find {{plantuml_dir}} -name "*.svg" -delete

# Install the pandoc/pandoc-plantuml toolchain used to render docs/*.md
docs-setup:
    PIPENV_PIPFILE={{docs_pipfile}} pipenv install

# Render a markdown file (with embedded ```plantuml fences) to standalone HTML.
# `file` is relative to docs/ — fenced blocks include diagrams via `!include ../plantuml/*.puml`,
# resolved relative to docs/plantuml-images/ (where the filter writes its temp .uml files), so
# pandoc must run with docs/ as its working directory.
docs-html file="architecture.md":
    cd {{docs_dir}} && PIPENV_PIPFILE=Pipfile JAVA_TOOL_OPTIONS="-Djava.io.tmpdir={{tmpdir}}" pipenv run pandoc {{file}} -o {{without_extension(file)}}.html --filter pandoc-plantuml --standalone

# Render architecture.md + data-model.md together into one standalone HTML document
docs-book:
    cd {{docs_dir}} && PIPENV_PIPFILE=Pipfile JAVA_TOOL_OPTIONS="-Djava.io.tmpdir={{tmpdir}}" pipenv run pandoc architecture.md data-model.md -o system-design.html --filter pandoc-plantuml --standalone --toc --metadata title="Common Platform — System Design"

# Remove generated docs HTML/SVG output (leaves .md sources and the venv alone)
docs-clean:
    find {{docs_dir}} -maxdepth 1 -name "*.html" -delete
    find {{docs_dir}} -maxdepth 1 -name "*.svg" -type l -delete
    rm -rf {{docs_dir}}/plantuml-images
