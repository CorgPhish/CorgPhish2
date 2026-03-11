#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$ROOT_DIR/CorgPhish/src/content"
OUT_FILE="$ROOT_DIR/CorgPhish/content.js"

parts=(
  "$SRC_DIR/01-bootstrap-and-constants.js"
  "$SRC_DIR/02-domain-and-content-risk.js"
  "$SRC_DIR/03-links-storage-redirects-antiscam.js"
  "$SRC_DIR/04-sensitive-ui-and-signals.js"
  "$SRC_DIR/05-blocking-init-and-events.js"
)

for part in "${parts[@]}"; do
  if [[ ! -f "$part" ]]; then
    echo "Missing content module: $part" >&2
    exit 1
  fi
done

: > "$OUT_FILE"
for part in "${parts[@]}"; do
  cat "$part" >> "$OUT_FILE"
done

echo "Built content script: $OUT_FILE"
