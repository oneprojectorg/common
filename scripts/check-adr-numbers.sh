#!/usr/bin/env bash
# Checks the ADR numbers in docs/adr. The author numbers an ADR in the pull
# request; nothing renumbers it after the merge.
#
#   check-adr-numbers.sh             check file names, headings, duplicates
#                                    and the index in the README
#   check-adr-numbers.sh <base-ref>  also fail when a new ADR does not take
#                                    the next free number on <base-ref>
#
# The index is what stops two pull requests from merging the same number. A
# check passes against the base as it was when the check ran, and a second
# pull request stays green after the first one merges. Both append a line to
# the index, so git reports a conflict and the second cannot merge unchanged.
set -euo pipefail

ADR_DIR="docs/adr"
INDEX="$ADR_DIR/README.md"
NAME_PATTERN='^[0-9]{4}-[a-z0-9]+(-[a-z0-9]+)*\.md$'

base="${1:-}"
if [[ $# -gt 1 || $base == -* ]]; then
  echo "Usage: $0 [base-ref]" >&2
  exit 2
fi

cd "$(git rev-parse --show-toplevel)"
shopt -s nullglob

# A branch cut before a change to the ADR folder still holds the old files.
# It is judged by the base branch's rules only once it touches an ADR.
if [[ -n $base ]]; then
  merge_base=$(git merge-base "$base" HEAD)
  changed=$(git diff --name-only "$merge_base" -- "$ADR_DIR")
  untracked=$(git ls-files --others --exclude-standard -- "$ADR_DIR")
  if [[ -z $changed && -z $untracked ]]; then
    echo "No ADR changes since $base."
    exit 0
  fi
fi

failed=0
problem() {
  echo "$*" >&2
  failed=1
}

adrs=()
numbers=""
expected_index=""
for file in "$ADR_DIR"/*.md; do
  name=$(basename "$file")
  if [[ $name == README.md || $name == adr-template.md ]]; then
    continue
  fi
  if [[ ! $name =~ $NAME_PATTERN ]]; then
    problem "$file: name an ADR NNNN-short-title.md, with the next free number."
    continue
  fi
  adrs+=("$file")
  number=${name:0:4}
  numbers+="$number"$'\n'
  heading=$(head -1 "$file")
  if [[ $heading != "# $number. "* ]]; then
    problem "$file: the first line must start with '# $number. '."
  fi
  expected_index+="- [${heading#\# }](./$name)"$'\n'
done

duplicates=$(printf '%s' "$numbers" | sort | uniq -d | tr '\n' ' ')
if [[ -n $duplicates ]]; then
  problem "Duplicate ADR numbers in $ADR_DIR: ${duplicates% }"
fi

# One line per ADR, in number order, each the ADR's heading linked to its file.
actual_index=$(grep -E '^- \[[0-9]{4}\. ' "$INDEX" 2>/dev/null || true)
if [[ $actual_index != "${expected_index%$'\n'}" ]]; then
  problem "The index in $INDEX does not list every ADR in order. It should read:"
  printf '%s' "$expected_index" | sed 's/^/  /' >&2
fi

if [[ -n $base ]]; then
  newest_on_base=$(git ls-tree --name-only "$base" "$ADR_DIR/" | sed 's#.*/##' \
    | grep -E "$NAME_PATTERN" | sort | tail -1 || true)
  next=$((10#${newest_on_base:0:4} + 1))

  # Read from the working tree, so an ADR not yet committed is checked too.
  for file in ${adrs[@]+"${adrs[@]}"}; do
    # Not new if the branch started with it, or if a squash merge of a stacked
    # PR's parent already put it on the base. An ADR renamed to a new number
    # is in neither, so it counts as new.
    if git cat-file -e "$merge_base:$file" 2>/dev/null || git cat-file -e "$base:$file" 2>/dev/null; then
      continue
    fi
    expected=$(printf '%04d' "$next")
    name=$(basename "$file")
    if [[ ${name:0:4} != "$expected" ]]; then
      problem "$file: the next free number on $base is $expected. Merge $base, then rename the file and fix its heading, its index line and any link to it."
    fi
    next=$((next + 1))
  done
fi

if [[ $failed -ne 0 ]]; then
  exit 1
fi

echo "ADR numbers are in order."
