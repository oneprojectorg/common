#!/usr/bin/env bash
# Checks the ADR numbers in docs/adr. The author numbers an ADR in the pull
# request; nothing renumbers it after the merge.
#
#   check-adr-numbers.sh             check file names, headings and duplicates
#   check-adr-numbers.sh <base-ref>  also fail when an ADR that HEAD adds does
#                                    not take the next free number on <base-ref>
set -euo pipefail

ADR_DIR="docs/adr"
NAME_PATTERN='^[0-9]{4}-[a-z0-9]+(-[a-z0-9]+)*\.md$'

base="${1:-}"
if [[ $# -gt 1 || $base == -* ]]; then
  echo "Usage: $0 [base-ref]" >&2
  exit 2
fi

cd "$(git rev-parse --show-toplevel)"
shopt -s nullglob

failed=0
problem() {
  echo "$*" >&2
  failed=1
}

numbers=""
for file in "$ADR_DIR"/*.md; do
  name=$(basename "$file")
  if [[ $name == README.md || $name == adr-template.md ]]; then
    continue
  fi
  if [[ ! $name =~ $NAME_PATTERN ]]; then
    problem "$file: name an ADR NNNN-short-title.md, with the next free number."
    continue
  fi
  number=${name:0:4}
  numbers+="$number"$'\n'
  if [[ $(head -1 "$file") != "# $number. "* ]]; then
    problem "$file: the first line must start with '# $number. '."
  fi
done

duplicates=$(printf '%s' "$numbers" | sort | uniq -d | tr '\n' ' ')
if [[ -n $duplicates ]]; then
  problem "Duplicate ADR numbers in $ADR_DIR: ${duplicates% }"
fi

if [[ -n $base ]]; then
  newest_on_base=$(git ls-tree --name-only "$base" "$ADR_DIR/" | sed 's#.*/##' \
    | grep -E "$NAME_PATTERN" | sort | tail -1 || true)
  next=$((10#${newest_on_base:0:4} + 1))

  # Added since the merge base, so an ADR the base removed is not an add.
  # --no-renames so an ADR renamed to a new number shows up as one.
  added=$(git diff --name-only --diff-filter=A --no-renames "$base...HEAD" -- "$ADR_DIR" | sort)

  while IFS= read -r file; do
    name=$(basename "$file")
    # A squash merge of a stacked PR's parent already put this one on the base.
    if [[ ! $name =~ $NAME_PATTERN ]] || git cat-file -e "$base:$file" 2>/dev/null; then
      continue
    fi
    expected=$(printf '%04d' "$next")
    if [[ ${name:0:4} != "$expected" ]]; then
      problem "$file: the next free number on $base is $expected. Merge $base, then rename the file and fix its heading."
    fi
    next=$((next + 1))
  done <<< "$added"
fi

if [[ $failed -ne 0 ]]; then
  exit 1
fi

echo "ADR numbers are in order."
