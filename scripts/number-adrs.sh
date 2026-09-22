#!/usr/bin/env bash
# Number draft ADRs.
#
# Renames every docs/adr/draft-<title>.md to docs/adr/NNNN-<title>.md, where
# NNNN is the next free four-digit number, and stages the rename with `git mv`.
# With --push it also commits the renames and pushes them to the current branch.
# If the push is rejected because the branch moved, it undoes the renames,
# pulls, and numbers again against the fresh tree, so an ADR that landed in the
# meantime (numbered by hand or by another run) can never share a number.
#
# CI runs it with --push when a draft lands on the default branch (see
# .github/workflows/adr-numbering.yml) and with --check on every pull request,
# which only fails if two ADRs share a number. Run it without a flag to number
# a draft locally.
set -euo pipefail

ADR_DIR="docs/adr"

push=false
check_only=false
case "${1:-}" in
  '') ;;
  --push) push=true ;;
  --check) check_only=true ;;
  *)
    echo "Usage: $0 [--push | --check]" >&2
    exit 2
    ;;
esac

cd "$(git rev-parse --show-toplevel)"

if $push; then
  branch=$(git symbolic-ref --quiet --short HEAD) || {
    echo "HEAD is detached; check out a branch before running with --push." >&2
    exit 1
  }
fi

shopt -s nullglob

# Fails if two numbered ADRs share a number, e.g. one that was numbered by hand.
check_unique() {
  local numbered dupes
  dupes=$(
    for numbered in "$ADR_DIR"/[0-9][0-9][0-9][0-9]-*.md; do
      basename "$numbered" | cut -c1-4
    done | sort | uniq -d | tr '\n' ' '
  )
  if [[ -n $dupes ]]; then
    echo "Duplicate ADR numbers in $ADR_DIR: ${dupes% }" >&2
    return 1
  fi
}

# Renames every draft to the next free number and records each rename in
# $renames as "<draft><tab><target>". Returns 1 when there is nothing to do.
renames=()
number_drafts() {
  local drafts=("$ADR_DIR"/draft-*.md)
  if [[ ${#drafts[@]} -eq 0 ]]; then
    echo "No draft ADRs to number."
    return 1
  fi

  # Highest number already taken, including any rename staged but not committed.
  local next=0 numbered num draft target
  for numbered in "$ADR_DIR"/[0-9][0-9][0-9][0-9]-*.md; do
    num=$((10#$(basename "$numbered" | cut -c1-4)))
    if (( num > next )); then
      next=$num
    fi
  done

  for draft in "${drafts[@]}"; do
    next=$((next + 1))
    target="$ADR_DIR/$(printf '%04d' "$next")-${draft#"$ADR_DIR"/draft-}"
    git mv "$draft" "$target"
    renames+=("$draft"$'\t'"$target")
    echo "Renamed $draft -> $target"
  done
}

# Moves every file recorded by number_drafts back to its draft name.
undo_renames() {
  local pair
  for pair in ${renames[@]+"${renames[@]}"}; do
    git mv "${pair#*$'\t'}" "${pair%%$'\t'*}"
  done
  renames=()
}

check_unique

if $check_only; then
  echo "ADR numbers are unique."
  exit 0
fi

if ! $push; then
  number_drafts || exit 0
  echo "Renames are staged. Commit them, or re-run with --push."
  exit 0
fi

for attempt in 1 2 3; do
  number_drafts || exit 0
  # Commit only the ADR directory, so a local run never sweeps up other staged work.
  git -c user.name='github-actions[bot]' \
      -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
      commit --quiet -m 'chore(adr): number merged ADR drafts [skip ci]' -- "$ADR_DIR"

  if git push origin "HEAD:$branch"; then
    echo "Pushed to $branch."
    exit 0
  fi

  if [[ $attempt -lt 3 ]]; then
    echo "Push rejected; syncing with origin/$branch and numbering again."
    git reset --quiet --soft HEAD~1
    undo_renames
    git pull --quiet --rebase --autostash origin "$branch"
    check_unique
  fi
done

echo "Could not push to $branch after 3 attempts; the numbering commit is still local." >&2
exit 1
