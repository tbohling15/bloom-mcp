#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="$HOME/bloom-mcp"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "Bloom Growth MCP — installer"
echo "=============================="
echo ""

# ---- 1. Check Node ----
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is not installed."
  echo "Install it from https://nodejs.org (v18 or later), then re-run this script."
  exit 1
fi

NODE_MAJOR=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "ERROR: Node.js v18+ required (you have $(node -v))."
  echo "Update at https://nodejs.org, then re-run."
  exit 1
fi
echo "✓ Node.js $(node -v)"

# ---- 2. Check 1Password CLI ----
if ! command -v op &>/dev/null; then
  echo ""
  echo "ERROR: 1Password CLI (op) is not installed."
  echo "Install it from https://developer.1password.com/docs/cli/get-started/"
  echo "Then sign in with: op signin"
  exit 1
fi
echo "✓ 1Password CLI found"

# ---- 3. Verify 1Password item ----
echo ""
echo "Checking 1Password for Bloom Growth credentials..."
if ! op read "op://Employee/Bloom Growth/Email" &>/dev/null; then
  echo ""
  echo "ERROR: Could not read 'op://Employee/Bloom Growth/Email' from 1Password."
  echo ""
  echo "Fix: In 1Password, open the 'Employee' vault and create an item named"
  echo "     'Bloom Growth' with fields: Email and Password (your Bloom login)."
  echo ""
  echo "Then re-run this script."
  exit 1
fi
echo "✓ Bloom Growth credentials found in 1Password"

# ---- 4. Copy server files ----
echo ""
if [ "$SOURCE_DIR" != "$INSTALL_DIR" ]; then
  echo "Copying server to $INSTALL_DIR..."
  cp -r "$SOURCE_DIR" "$INSTALL_DIR"
else
  echo "Running from install directory: $INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# ---- 5. Install dependencies + build ----
echo "Installing dependencies..."
npm install --silent

echo "Building..."
npm run build --silent
echo "✓ Build complete"

# ---- 6. Register in Claude configs ----
echo ""
echo "Registering bloom-growth MCP server..."

python3 - <<PYEOF
import json, pathlib

entry = {
    'command': 'node',
    'args': [str(pathlib.Path.home() / 'bloom-mcp/dist/index.js')]
}

# Claude Code
cc_path = pathlib.Path.home() / '.claude.json'
if cc_path.exists():
    d = json.loads(cc_path.read_text())
    d.setdefault('mcpServers', {})['bloom-growth'] = entry
    cc_path.write_text(json.dumps(d, indent=2))
    print("✓ Registered in Claude Code (~/.claude.json)")

# Claude Desktop (macOS)
desktop_path = pathlib.Path.home() / 'Library/Application Support/Claude/claude_desktop_config.json'
if desktop_path.exists():
    d = json.loads(desktop_path.read_text())
    d.setdefault('mcpServers', {})['bloom-growth'] = entry
    desktop_path.write_text(json.dumps(d, indent=2))
    print("✓ Registered in Claude Desktop")
elif not cc_path.exists():
    print("WARNING: Neither ~/.claude.json nor Claude Desktop config found.")
    print("         You may need to add the server manually.")
PYEOF

# ---- Done ----
echo ""
echo "=============================="
echo "Setup complete!"
echo ""
echo "Next: restart Claude Code, then try:"
echo "  \"Show me my Bloom Growth scorecard\""
echo "  \"List my measurables in Bloom\""
echo "  \"Update my [metric] score to [value] in Bloom Growth\""
echo ""
