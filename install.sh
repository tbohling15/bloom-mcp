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

# ---- 2. Check for 1Password CLI (optional) ----
HAS_1PASSWORD=false
if command -v op &>/dev/null && op read "op://Employee/Bloom Growth/Email" &>/dev/null; then
  HAS_1PASSWORD=true
  echo "✓ 1Password CLI found with Bloom Growth credentials"
else
  echo "ℹ 1Password not available or 'Bloom Growth' item not found — that's fine, not required."
fi

# ---- 3. Collect credentials if 1Password isn't set up ----
BLOOM_USERNAME_INPUT=""
BLOOM_PASSWORD_INPUT=""

if [ "$HAS_1PASSWORD" = false ] && [ -z "${BLOOM_USERNAME:-}" ]; then
  echo ""
  echo "No 1Password credentials and no BLOOM_USERNAME/BLOOM_PASSWORD env vars set."
  echo "You can enter your Bloom Growth login now to save it directly into your"
  echo "Claude MCP config (hardcoded, no 1Password required)."
  echo ""
  read -r -p "Enter your Bloom Growth email (or press Enter to skip): " BLOOM_USERNAME_INPUT
  if [ -n "$BLOOM_USERNAME_INPUT" ]; then
    read -r -s -p "Enter your Bloom Growth password: " BLOOM_PASSWORD_INPUT
    echo ""

    echo "Verifying credentials against Bloom Growth..."
    AUTH_CHECK=$(curl -s -X POST "https://app.bloomgrowth.com/Token" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      --data-urlencode "grant_type=password" \
      --data-urlencode "userName=${BLOOM_USERNAME_INPUT}" \
      --data-urlencode "password=${BLOOM_PASSWORD_INPUT}")

    if echo "$AUTH_CHECK" | grep -q "access_token"; then
      echo "✓ Bloom Growth login verified"
    else
      echo ""
      echo "ERROR: Bloom Growth login failed. Response: $AUTH_CHECK"
      echo "Re-run this script and double-check your email/password."
      exit 1
    fi
  else
    echo "Skipping — you can set BLOOM_USERNAME/BLOOM_PASSWORD env vars, or run"
    echo "\"Set up my Bloom Growth credentials\" in Claude after install."
  fi
fi

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

export BLOOM_USERNAME_INPUT
export BLOOM_PASSWORD_INPUT

python3 - <<PYEOF
import json, pathlib, os

entry = {
    'command': 'node',
    'args': [str(pathlib.Path.home() / 'bloom-mcp/dist/index.js')]
}

username = os.environ.get('BLOOM_USERNAME_INPUT', '')
password = os.environ.get('BLOOM_PASSWORD_INPUT', '')
if username and password:
    entry['env'] = {'BLOOM_USERNAME': username, 'BLOOM_PASSWORD': password}

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
