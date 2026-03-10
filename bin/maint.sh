#!/bin/bash

set -euo pipefail

REPO_TARBALL="https://codeload.github.com/pixlcore/xyops/tar.gz/refs/heads/main"
DEST="/opt/poolnoodle/apps/docs.xyops.io/docs"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT INT TERM

# Download + extract entire repo tarball into temp
curl -fsSL "$REPO_TARBALL" | tar -xzf - -C "$tmp"

# Sync only the docs dir into DEST
# --delete makes DEST match upstream (removes files deleted from repo docs/)
rsync -a --delete "$tmp"/*/docs/ "$DEST"/
