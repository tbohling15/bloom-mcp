#!/usr/bin/env bash
# Manual/foreground start for testing the Bloom Growth MCP server directly.
# Claude and other MCP clients normally spawn this process themselves via
# their config file — you do NOT need to run this script for Claude to work.
# Use this only to sanity-check the server responds, or for debugging.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -z "${BLOOM_USERNAME:-}" ] || [ -z "${BLOOM_PASSWORD:-}" ]; then
  echo "BLOOM_USERNAME / BLOOM_PASSWORD not set in this shell."
  echo "Set them first, e.g.:"
  echo "  export BLOOM_USERNAME=\"you@example.com\""
  echo "  export BLOOM_PASSWORD=\"yourpassword\""
  echo ""
  echo "(Or skip this — the server also checks ~/.bloom-mcp/credentials.json"
  echo " and 1Password automatically if env vars aren't set.)"
  echo ""
fi

echo "Starting bloom-mcp (stdio) — press Ctrl+C to stop."
echo "Sending a test 'initialize' request to confirm it responds:"
echo ""

echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2026-06-18","capabilities":{},"clientInfo":{"name":"start-sh-test","version":"1.0"}}}' \
  | node "$SCRIPT_DIR/dist/index.js"
