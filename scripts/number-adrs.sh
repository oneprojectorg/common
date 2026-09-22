#!/usr/bin/env bash
# Renames docs/adr/draft-<title>.md to docs/adr/NNNN-<title>.md with the next
# free number and sets the `# NNNN.` heading to match.
#
#   number-adrs.sh               stage the renames
#   number-adrs.sh --push        commit and push them; retries if the branch moved
#   number-adrs.sh --check [ref] fail on a duplicate number, or on a numbered
#                                ADR added since <ref>
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

check_unique() {
  local numbered dupes
  dupes=$(
    # shellcheck disable=SC2231
    for numbered in $NUMBERED_GLOB; do
      basename "$numbered" | cut -c1-4
    done | sort | uniq -d | tr '\n' ' '
  )
  if [[ -n $dupes ]]; then
    echo "Duplicate ADR numbers in $ADR_DIR: ${dupes% }" >&2
    return 1
  fi
}

check_no_hand_numbering() {
  local added
  # --no-renames so a draft renamed by hand shows up as an add.
  added=$(git diff --name-only --diff-filter=A --no-renames "$base" HEAD -- "$ADR_DIR" \
    | grep -E "^$ADR_DIR/[0-9]{4}-.*\.md$" || true)
  if [[ -n $added ]]; then
    echo "These ADRs were numbered by hand:" >&2
    printf '  %s\n' "${added//$'\n'/$'\n'  }" >&2
    echo "Commit an ADR as $ADR_DIR/draft-<title>.md; CI numbers it on merge." >&2
    return 1
  fi
}

has_drafts() {
  local drafts=("$ADR_DIR"/draft-*.md)
  [[ ${#drafts[@]} -gt 0 ]]
}

# "<draft>\t<target>" per rename, for undo_renames.
renames=()
number_drafts() {
  local drafts=("$ADR_DIR"/draft-*.md)
  local next=0 numbered num draft padded target
  # shellcheck disable=SC2231
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
    git add "$draft"
    git mv "$draft" "$target"
    sed "1s/^# NNNN\\./# $padded./" "$target" > "$target.tmp"
    mv "$target.tmp" "$target"
    git add "$target"
    renames+=("$draft"$'\t'"$target")
    echo "Renamed $draft -> $target"
  done
}

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
    if ! has_drafts; then
      echo "No draft ADRs to number."
      exit 0
    fi
    number_drafts
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
  if ! has_drafts; then
    echo "No draft ADRs to number."
    exit 0
  fi
  number_drafts
  parent=$(git rev-parse HEAD)
  git -c user.name='github-actions[bot]' \
      -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
      commit --quiet -m 'chore(adr): number merged ADR drafts [skip ci]'

  if git push origin "HEAD:$branch"; then
    echo "Pushed to $branch."
    exit 0
  fi

  # Only a moved branch is worth a retry.
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
