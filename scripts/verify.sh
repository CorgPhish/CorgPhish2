#!/usr/bin/env bash
set -euo pipefail

# RU: Проверка проекта перед релизом и CI: пересборка content script, версия и обязательные файлы.
# EN: Release/CI verification script.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$ROOT_DIR/apps/extension/manifest.json"
BUILD_CONTENT="$ROOT_DIR/scripts/build-content.sh"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required" >&2
  exit 1
fi

if ! command -v zip >/dev/null 2>&1; then
  echo "zip is required" >&2
  exit 1
fi

if [[ ! -f "$MANIFEST" ]]; then
  echo "manifest.json not found at $MANIFEST" >&2
  exit 1
fi

if [[ ! -x "$BUILD_CONTENT" ]]; then
  echo "build-content.sh not found or not executable at $BUILD_CONTENT" >&2
  exit 1
fi

"$BUILD_CONTENT"

python3 - <<'PY'
import json
from pathlib import Path
manifest = Path("apps/extension/manifest.json")
if not manifest.exists():
    raise SystemExit("manifest.json missing")
version = json.loads(manifest.read_text()).get("version")
if not version:
    raise SystemExit("manifest.json missing version")
print(f"Version: {version}")
PY

# Минимальный набор файлов, без которого расширение нельзя публиковать или проверять локально.
required_files=(
  "apps/extension/trusted.json"
  "apps/extension/assets/models/hybrid_tfidf_num.onnx"
  "apps/extension/assets/vendor/ort/ort.min.js"
  "apps/extension/assets/vendor/ort/ort.module.js"
  "apps/extension/assets/vendor/ort/ort-wasm.wasm"
  "apps/extension/assets/vendor/ort/ort-wasm-simd.wasm"
  "apps/extension/popup/index.html"
  "apps/extension/popup/popup.css"
  "apps/extension/popup/main.js"
  "apps/extension/content/index.js"
  "apps/extension/background/index.js"
)

missing=0
for file in "${required_files[@]}"; do
  if [[ ! -f "$ROOT_DIR/$file" ]]; then
    echo "Missing file: $file" >&2
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

tag="${1:-}"
if [[ -n "$tag" ]]; then
  version=$(python3 - <<'PY'
import json
from pathlib import Path
manifest = Path("apps/extension/manifest.json")
print(json.loads(manifest.read_text()).get("version", ""))
PY
  )
  expected="v${version}"
  if [[ "$tag" != "$expected" ]]; then
    echo "Tag $tag does not match manifest version $expected" >&2
    exit 1
  fi
fi
