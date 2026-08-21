#!/usr/bin/env bash
# Install the pinned `typos` spell checker into node_modules/.bin.
#
# typos is a Rust binary. No npm package is safe to depend on, so this script
# downloads the official release. pnpm puts node_modules/.bin on PATH, so
# `pnpm spellcheck` calls `typos` directly and needs no wrapper.
#
# Upstream publishes no checksums. The digests below are ours. The script
# discards a download that does not match.
#
# VERSION is the only version pin. The Spelling job in
# .github/workflows/spellcheck.yml runs this script, so CI and developers use
# the same binary.
#
# The script does nothing when the correct version is already installed.

set -euo pipefail

VERSION="1.49.0"

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m!!\033[0m %s\n' "$*" >&2; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="${ROOT}/node_modules/.bin/typos"

# --- Already installed? -------------------------------------------------------
if [[ -x "${BIN}" ]] && "${BIN}" --version 2>/dev/null | grep -qF "${VERSION}"; then
  exit 0
fi

# --- Pick the build for this machine -----------------------------------------
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64)
    ASSET="typos-v${VERSION}-aarch64-apple-darwin.tar.gz"
    SHA256="8c0e7bd40b2b60c0b0cfe9f74dd814b4d4385c956ce86860f7da9e62d91fdc73" ;;
  Darwin-x86_64)
    ASSET="typos-v${VERSION}-x86_64-apple-darwin.tar.gz"
    SHA256="4cecbf653a9fc45f023abf57f4e2e2f6b138c2d2387b09289beacdd3f0ea7bfd" ;;
  Linux-aarch64 | Linux-arm64)
    ASSET="typos-v${VERSION}-aarch64-unknown-linux-musl.tar.gz"
    SHA256="85c8b87b22a0fb1da130cd4d495e0beba7f1225eb580933184509e146ec4c509" ;;
  Linux-x86_64)
    ASSET="typos-v${VERSION}-x86_64-unknown-linux-musl.tar.gz"
    SHA256="48bd2d58e02ce713b8c0f1aa239e68ee4f7d8c551013135806e6aed3938d9e10" ;;
  *)
    die "no typos build for $(uname -s)-$(uname -m). Install it yourself (cargo install typos-cli) and put it on PATH." ;;
esac

# --- Download, verify, install ------------------------------------------------
STAGING="$(mktemp -d)"
trap 'rm -rf "${STAGING}"' EXIT

log "Downloading typos ${VERSION}…"
curl -fsSL -o "${STAGING}/${ASSET}" \
  "https://github.com/crate-ci/typos/releases/download/v${VERSION}/${ASSET}" ||
  die "could not download ${ASSET} — this needs network access to github.com."

# macOS ships shasum, most Linux images ship sha256sum; take whichever is here.
if command -v sha256sum >/dev/null; then
  ACTUAL="$(sha256sum "${STAGING}/${ASSET}" | cut -d' ' -f1)"
else
  ACTUAL="$(shasum -a 256 "${STAGING}/${ASSET}" | cut -d' ' -f1)"
fi

if [[ "${ACTUAL}" != "${SHA256}" ]]; then
  die "checksum mismatch for ${ASSET}
  expected ${SHA256}
  received ${ACTUAL}
Refusing to install it. If the release was re-cut, update the digest in $0."
fi

tar -xzf "${STAGING}/${ASSET}" -C "${STAGING}" ||
  die "could not unpack ${ASSET}"

[[ -f "${STAGING}/typos" ]] || die "${ASSET} did not contain a typos binary"

mkdir -p "$(dirname "${BIN}")"
chmod +x "${STAGING}/typos"
mv "${STAGING}/typos" "${BIN}"

log "Installed typos ${VERSION} -> ${BIN}"
