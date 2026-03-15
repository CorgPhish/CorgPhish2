#!/usr/bin/env bash
set -euo pipefail

# RU: Склеивает модульные исходники content script в итоговый CorgPhish/content.js.
# EN: Builds the final content.js from ordered source modules.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$ROOT_DIR/CorgPhish/src/content"
OUT_FILE="$ROOT_DIR/CorgPhish/content.js"
TMP_FILE="$(mktemp "${OUT_FILE}.tmp.XXXXXX")"

cleanup() {
  rm -f "$TMP_FILE"
}
trap cleanup EXIT

# Порядок важен: каждый следующий модуль опирается на состояние и helper-функции предыдущих.
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

# Пишем во временный файл и только потом атомарно заменяем content.js,
# чтобы параллельная сборка или чтение не видели частично записанный файл.
: > "$TMP_FILE"
for part in "${parts[@]}"; do
  cat "$part" >> "$TMP_FILE"
done

mv "$TMP_FILE" "$OUT_FILE"
trap - EXIT

echo "Built content script: $OUT_FILE"
