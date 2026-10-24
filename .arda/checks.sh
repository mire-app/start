#!/usr/bin/env bash
# Project checks for Míre (SPEC-0002 CA-09). Run by the Claude Code stop hook and by arda-gate in CI.
# Steps, stopping at the first failure: install, exact versions, lint, format, types, unit tests, build, e2e.
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n== checks.sh: %s\n' "$1"; }

# --- Skip mode: outside CI, documentation-only changes against origin/main run nothing. ---
if [ "${CI:-}" != "true" ]; then
  if changed=$(
    {
      git diff --name-only origin/main...HEAD &&
        git diff --name-only HEAD &&
        git ls-files --others --exclude-standard
    } 2>/dev/null
  ); then
    if ! printf '%s\n' "$changed" | grep -qv -e '^docs/' -e '^\.arda/active-spec$' -e '^$'; then
      echo "checks.sh: only docs/ or .arda/active-spec changed against origin/main; skipping."
      exit 0
    fi
  fi
fi

# --- Node: use the major in .nvmrc; download it from nodejs.org if missing (or without corepack). ---
NODE_MAJOR=$(tr -d '[:space:]v' < .nvmrc)
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != "v${NODE_MAJOR}."* ]] ||
  ! command -v corepack >/dev/null 2>&1; then
  NODE_DIR="$PWD/.cache/node"
  if [[ "$("$NODE_DIR/bin/node" -v 2>/dev/null)" != "v${NODE_MAJOR}."* ]]; then
    step "downloading Node ${NODE_MAJOR}.x"
    case "$(uname -m)" in
      x86_64) arch=x64 ;;
      aarch64 | arm64) arch=arm64 ;;
      *) echo "checks.sh: unsupported architecture $(uname -m)" >&2; exit 1 ;;
    esac
    case "$(uname -s)" in
      Linux) os=linux ;;
      Darwin) os=darwin ;;
      *) echo "checks.sh: unsupported OS $(uname -s)" >&2; exit 1 ;;
    esac
    base="https://nodejs.org/dist/latest-v${NODE_MAJOR}.x"
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    curl -fsSL "$base/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt"
    file=$(grep -oE "node-v[0-9.]+-${os}-${arch}\.tar\.gz$" "$tmp/SHASUMS256.txt" | head -n1)
    [ -n "$file" ] || { echo "checks.sh: no Node build for ${os}-${arch}" >&2; exit 1; }
    curl -fsSL "$base/$file" -o "$tmp/$file"
    (cd "$tmp" && grep " ${file}\$" SHASUMS256.txt | sha256sum -c --status) ||
      { echo "checks.sh: checksum mismatch for $file" >&2; exit 1; }
    rm -rf "$NODE_DIR"
    mkdir -p "$NODE_DIR"
    tar -xzf "$tmp/$file" -C "$NODE_DIR" --strip-components=1
  fi
  export PATH="$NODE_DIR/bin:$PATH"
fi
echo "checks.sh: node $(node -v)"

# --- pnpm through corepack (version pinned in packageManager), no global install. ---
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
pnpm() { corepack pnpm "$@"; }

step "install"
pnpm install --frozen-lockfile

step "exact versions (CA-01)"
node -e '
  const pkg = require("./package.json");
  const exact = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
  const bad = [];
  for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    for (const [name, version] of Object.entries(pkg[field] ?? {})) {
      if (!exact.test(version)) bad.push(`${field}.${name}: ${version}`);
    }
  }
  if (bad.length) {
    console.error("Dependencies without an exact version:\n  " + bad.join("\n  "));
    process.exit(1);
  }
'

step "lint"
pnpm lint
step "format"
pnpm format:check
step "types"
pnpm typecheck
step "unit tests"
pnpm test
step "build"
pnpm build

step "e2e"
if sudo -n true 2>/dev/null; then
  pnpm exec playwright install --with-deps chromium
else
  pnpm exec playwright install chromium
fi
pnpm test:e2e

echo
echo "checks.sh: all checks passed."
