#!/usr/bin/env bash
# Prepares a Claude Code cloud session (CLAUDE_CODE_REMOTE=true): Node from .node-version, pnpm
# pinned by package.json, dependencies and the Chromium of the browser tests. Does nothing elsewhere.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}"

persist_path() {
  export PATH="$1:$PATH"
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo "export PATH=\"$1:\$PATH\"" >>"$CLAUDE_ENV_FILE"
  fi
}

wanted=$(cut -d. -f1 .node-version)
current=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$current" -lt "$wanted" ]; then
  installed=$(ls -d /opt/node-v"$wanted".*-linux-x64 2>/dev/null | tail -n 1 || true)
  if [ -z "$installed" ]; then
    base="https://nodejs.org/dist/latest-v$wanted.x"
    work=$(mktemp -d)
    curl -fsSL "$base/SHASUMS256.txt" -o "$work/SHASUMS256.txt"
    tarball=$(awk '/ node-v[0-9.]+-linux-x64\.tar\.xz$/ {print $2}' "$work/SHASUMS256.txt")
    curl -fsSL "$base/$tarball" -o "$work/$tarball"
    (cd "$work" && grep " $tarball\$" SHASUMS256.txt | sha256sum -c --quiet -)
    tar -xJf "$work/$tarball" -C /opt
    rm -rf "$work"
    installed="/opt/${tarball%.tar.xz}"
  fi
  persist_path "$installed/bin"
fi
echo "node $(node --version)"

export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack enable
echo "pnpm $(pnpm --version)"

pnpm install --frozen-lockfile

if ! pnpm exec playwright install --with-deps chromium; then
  echo "Chromium for the browser tests could not be installed: allow the Playwright download hosts in the cloud environment's network settings." >&2
fi
