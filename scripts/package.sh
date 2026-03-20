#!/usr/bin/env bash
set -euo pipefail

# RU: Собирает релизный ZIP с актуальным content/index.js и версией из manifest.json.
# EN: Packages the extension into a release ZIP.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$ROOT_DIR/apps/extension/manifest.json"
BUILD_CONTENT="$ROOT_DIR/scripts/build-content.sh"

if [[ ! -f "$MANIFEST" ]]; then
  echo "manifest.json not found at $MANIFEST" >&2
  exit 1
fi

if [[ ! -x "$BUILD_CONTENT" ]]; then
  echo "build-content.sh not found or not executable at $BUILD_CONTENT" >&2
  exit 1
fi

# Перед упаковкой всегда обновляем content/index.js из модульных исходников.
"$BUILD_CONTENT"

VERSION=$(python3 - <<'PY'
import json
from pathlib import Path
manifest = Path("apps/extension/manifest.json")
print(json.loads(manifest.read_text()).get("version", "0.0.0"))
PY
)

OUT_DIR="$ROOT_DIR/dist"
OUT_FILE="${1:-$OUT_DIR/corgphish-release-v${VERSION}.zip}"

# Каталог релизов создаётся лениво, чтобы скрипт работал и в чистом клоне.
mkdir -p "$OUT_DIR"
rm -f "$OUT_FILE"

cd "$ROOT_DIR"
zip -r "$OUT_FILE" apps/extension -x "*.DS_Store"

echo "Packaged: $OUT_FILE"
