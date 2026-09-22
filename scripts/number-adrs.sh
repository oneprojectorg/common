#!/usr/bin/env bash
# Number draft ADRs.
#
# Renames every docs/adr/draft-<title>.md to docs/adr/NNNN-<title>.md, where
# NNNN is the next free four-digit number, rewrites the `# NNNN.` heading to
# match, and stages the result with `git mv`.
#
#   number-adrs.sh               Preview the renames locally; leaves them staged.
#   number-adrs.sh --push        Commit the renames as the Actions bot and push
#                                them to the current branch. Needs a clean tree.
#                                If the branch moved since checkout, undo, pull,
#                                and number again against the fresh tree, so an
#                                ADR that landed meanwhile never shares a number.
#   number-adrs.sh --check [ref] Fail if two ADRs share a number, or if the tree
#                                adds a numbered ADR relative to <ref>. A pull
#                                request may only add draft-*.md; CI assigns
#                                the number on merge.
#
# CI runs --push when a draft lands on the default branch
# (.github/workflows/adr-numbering.yml) and --check on every pull request
# (.github/workflows/pr-checks.yml).
set -euo pipefail

ADR_DIR="docs/adr"
NUMBERED_GLOB="$ADR_DIR/[0-9][0-9][0-9][0-9]-*.md"

mode=stage
base=""
case "${1:-}" in
  '') ;;
  --push) mode=push ;;
  --check)
    mode=check
    base="${2:-}"
    ;;
  *)
    echo "Usage: $0 [--push | --check [base-ref]]" >&2
    exit 2
    ;;
esac

cd "$(git rev-parse --show-toplevel)"
shopt -s nullglob

# Fails if two numbered ADRs share a number, e.g. one that was numbered by hand.
check_unique() {
  local numbered dupes
  dupes=$(
    # shellcheck disable=SC2231  # the glob is meant to expand
    for numbered in $NUMBERED_GLOB; do
      basename "$numbered" | cut -c1-4
    done | sort | uniq -d | tr '\n' ' '
  )
  if [[ -n $dupes ]]; then
    echo "Duplicate ADR numbers in $ADR_DIR: ${dupes% }" >&2
    return 1
  fi
}

# Fails if the tree adds a numbered ADR that <base> does not have. Renames are
# reported as an add plus a delete, so renaming a draft by hand is caught too.
check_no_hand_numbering() {
  local added
  added=$(git diff --name-only --diff-filter=A --no-renames "$base" HEAD -- "$ADR_DIR" \
    | grep -E "^$ADR_DIR/[0-9]{4}-.*\.md$" || true)
  if [[ -n $added ]]; then
    echo "These ADRs were numbered by hand:" >&2
    printf '  %s\n' "${added//$'\n'/$'\n'  }" >&2
    echo "Commit an ADR as $ADR_DIR/draft-<title>.md; CI numbers it on merge." >&2
    return 1
  fi
}

# Renames every draft to the next free number, rewrites its heading, and
# records each rename in $renames as "<draft><tab><target>". Returns 1 when
# there is nothing to do.
renames=()
number_drafts() {
  local drafts=("$ADR_DIR"/draft-*.md)
  if [[ ${#drafts[@]} -eq 0 ]]; then
    echo "No draft ADRs to number."
    return 1
  fi

  # Highest number already taken, including any rename staged but not committed.
  local next=0 numbered num draft padded target
  # shellcheck disable=SC2231  # the glob is meant to expand
  for numbered in $NUMBERED_GLOB; do
    num=$((10#$(basename "$numbered" | cut -c1-4)))
    if (( num > next )); then
      next=$num
    fi
  done

  for draft in "${drafts[@]}"; do
    next=$((next + 1))
    padded=$(printf '%04d' "$next")
    target="$ADR_DIR/$padded-${draft#"$ADR_DIR"/draft-}"
    git mv "$draft" "$target"
    # The template's first line is "# NNNN. <title>"; give it the real number.
    sed "1s/^# NNNN\\./# $padded./" "$target" > "$target.tmp"
    mv "$target.tmp" "$target"
    git add "$target"
    renames+=("$draft"$'\t'"$target")
    echo "Renamed $draft -> $target"
  done
}

# Moves every file recorded by number_drafts back to its draft name and
# restores its heading.
undo_renames() {
  local pair draft target
  for pair in ${renames[@]+"${renames[@]}"}; do
    draft="${pair%%$'\t'*}"
    target="${pair#*$'\t'}"
    git mv "$target" "$draft"
    git checkout --quiet HEAD -- "$draft"
  done
  renames=()
}

check_unique

case $mode in
  check)
    if [[ -n $base ]]; then
      check_no_hand_numbering
    fi
    echo "ADR numbers are unique."
    exit 0
    ;;
  stage)
    number_drafts || exit 0
    echo "Renames are staged. CI numbers a draft on merge; this run is a preview."
    exit 0
    ;;
esac

branch=$(git symbolic-ref --quiet --short HEAD) || {
  echo "HEAD is detached; check out a branch before running with --push." >&2
  exit 1
}
if [[ -n $(git status --porcelain) ]]; then
  echo "The working tree must be clean before running with --push." >&2
  exit 1
fi

for attempt in 1 2 3; do
  number_drafts || exit 0
  parent=$(git rev-parse HEAD)
  git -c user.name='github-actions[bot]' \
      -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
      commit --quiet -m 'chore(adr): number merged ADR drafts [skip ci]'

  if git push origin "HEAD:$branch"; then
    echo "Pushed to $branch."
    exit 0
  fi

  # Retry only when the branch moved. Any other rejection, such as branch
  # protection refusing the token, will not fix itself.
  git fetch --quiet origin "$branch"
  if [[ $(git rev-parse "origin/$branch") == "$parent" ]]; then
    echo "Push to $branch was rejected and the branch has not moved; giving up. The numbering commit is still local." >&2
    exit 1
  fi
  if [[ $attempt -lt 3 ]]; then
    echo "$branch moved; syncing and numbering again."
    git reset --quiet --soft "$parent"
    undo_renames
    git pull --quiet --rebase origin "$branch"
    check_unique
  fi
done

echo "Could not push to $branch after 3 attempts; the numbering commit is still local." >&2
exit 1
