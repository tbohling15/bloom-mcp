# bloom-mcp

MCP server for [Bloom Growth](https://www.bloomgrowth.com/) — update metrics, check scorecards, manage rocks and milestones directly from Claude or any MCP-compatible AI client.

---

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- A **Bloom Growth account** with your login email and password

Optional (LiveBy team only):
- **1Password CLI** — [install guide](https://developer.1password.com/docs/cli/get-started/), signed in with `op signin`

---

## Install

```bash
git clone https://github.com/tbohling15/bloom-mcp.git ~/bloom-mcp
cd ~/bloom-mcp
npm install
npm run build
bash install.sh
```

The installer registers the server in Claude Code (`~/.claude.json`) and Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`) automatically.

**1Password is optional.** If it's not installed, or the `Bloom Growth` item isn't found, `install.sh` will prompt you to enter your Bloom email/password directly — it verifies them against Bloom before saving, then writes them straight into your Claude config's `env` block (hardcoded per-user, no 1Password required). Press Enter at the prompt to skip and set up credentials another way later.

---

## Get your Bloom Growth credentials

The server authenticates using your Bloom Growth **email and password** — the same ones you use to log in at [app.bloomgrowth.com](https://app.bloomgrowth.com).

To confirm they work, run this in your terminal:

```bash
curl -s -X POST "https://app.bloomgrowth.com/Token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=password" \
  --data-urlencode "userName=you@example.com" \
  --data-urlencode "password=yourpassword"
```

A successful response returns JSON with an `access_token`. If you see an error, double-check your email and password in Bloom Growth.

---

## Set up credentials

### Option A — During install (hardcoded, no 1Password)

`install.sh` will prompt for your Bloom email/password if 1Password isn't set up (see above). This is the fastest path for anyone outside the LiveBy 1Password vault.

### Option B — Via Claude (easiest, no terminal needed)

After installing, open Claude and say:

> "Set up my Bloom Growth credentials"

Claude will call the `setup_credentials` tool, verify your login, and save your credentials to `~/.bloom-mcp/credentials.json` (owner-only, `chmod 600`). Run once and you're done.

Other credential tools you can use from Claude:
- `check_credentials` — confirm which auth source is active and test the connection
- `clear_credentials` — remove the locally stored credentials file

### Option C — Environment variables (manual)

Add to your shell profile, or directly to the `env` block of your MCP config entry:

```bash
export BLOOM_USERNAME="you@example.com"
export BLOOM_PASSWORD="yourpassword"
```

### Option D — 1Password CLI (LiveBy team)

Create a `Bloom Growth` item in your `Employee` 1Password vault with `Email` and `Password` fields. The server detects and uses it automatically.

```bash
op read "op://Employee/Bloom Growth/Email"    # should print your email
op read "op://Employee/Bloom Growth/Password"  # should print your password
```

**Auth priority:** env vars → local credentials file → 1Password

---

## Install in Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bloom-growth": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/bloom-mcp/dist/index.js"]
    }
  }
}
```

Replace `YOUR_USERNAME` with your macOS username. Restart Claude Desktop after saving.

---

## Install in Perplexity Computer (or any URL-based connector)

Perplexity Computer connects to a running HTTP address rather than spawning a process from a config file. Start bloom-mcp in HTTP mode:

```bash
BLOOM_USERNAME="you@example.com" BLOOM_PASSWORD="yourpassword" BLOOM_MCP_TRANSPORT=http node ~/bloom-mcp/dist/index.js
```

Leave that running, then enter this address in Perplexity's connector setup:

```
http://127.0.0.1:8420/mcp
```

Notes:
- The server binds to `127.0.0.1` only — never reachable from other machines on your network.
- No connector-side auth/API key is needed. Since only local processes can reach `127.0.0.1`, the trust boundary is the same as stdio — anyone who could configure the connector already has shell access to the machine.
- To use a different port: `BLOOM_MCP_PORT=9000 BLOOM_MCP_TRANSPORT=http node dist/index.js`, then use that port in the address.
- Keep this process running in the background — see [UPDATE.md](UPDATE.md) or use a terminal tab / `pm2` / `launchd` to keep it alive across reboots.

---

## Install in Claude Code (CLI)

The `install.sh` script handles this automatically. To add manually:

```bash
python3 - <<'EOF'
import json, pathlib
config = pathlib.Path.home() / '.claude.json'
d = json.loads(config.read_text()) if config.exists() else {}
d.setdefault('mcpServers', {})['bloom-growth'] = {
    'command': 'node',
    'args': [str(pathlib.Path.home() / 'bloom-mcp/dist/index.js')]
}
config.write_text(json.dumps(d, indent=2))
print('Done — restart Claude Code to activate.')
EOF
```

---

## Install via Claude Code (paste-in prompt)

Team members can paste this into a Claude Code session to run the full setup automatically:

```
Please set up the Bloom Growth MCP server for me. Here's what to do:

1. Run the install script at ~/Downloads/bloom-mcp/install.sh (adjust this path to wherever I saved the bloom-mcp folder)
2. The script will check for Node.js, build the server, and register it in my Claude config
3. After it finishes, confirm the setup worked and tell me what prompts I can use

Go ahead and run it now.
```

---

## Tools

| Tool | Description |
|---|---|
| `get_my_scorecard` | All your measurables with current scores |
| `list_my_measurables` | Metrics assigned to you |
| `get_measurable` | Details for one metric by ID |
| `get_score_history` | Full score history (includes week/score IDs for updates) |
| `update_score` | Update a score by score ID |
| `update_metric_for_week` | Post a score for a specific week |
| `list_meetings` | Your Level 10 meetings |
| `get_meeting_scorecard` | Scorecard for a specific meeting |
| `get_my_rocks` | Your quarterly rocks / goals |
| `get_user_rocks` | Rocks for a specific user (for managers) |
| `get_rock` | Full detail for one rock including status and completion |
| `update_rock` | Set rock status (OnTrack/OffTrack/Done) and completion % |
| `get_rock_milestones` | List milestones for a rock |
| `add_rock_milestone` | Add a new milestone to a rock |
| `get_meeting_todos` | Open todos for a meeting |
| `get_todo_notes` | Notes/details text for a single todo |
| `get_meeting_todos_with_notes` | Todos enriched with notes, status, and a top-level meeting link — built for Slack digests |
| `setup_credentials` | Save Bloom credentials locally (no 1Password needed) |
| `check_credentials` | Confirm auth source and test connection |
| `clear_credentials` | Remove locally stored credentials |

## Manual testing (optional)

You don't need to run this for Claude to work — Claude spawns the server itself. Use `start.sh` only to sanity-check the server responds outside of Claude:

```bash
BLOOM_USERNAME="you@example.com" BLOOM_PASSWORD="yourpassword" bash start.sh
```

A healthy server prints a JSON `initialize` response and exits (stdio servers close when their input stream ends — that's expected, not a crash).

## Example prompts

- "Show me my Bloom Growth scorecard"
- "Update my Pending Agreements score to 4 for this week"
- "List my quarterly rocks in Bloom"
- "Show milestones for my MCP Connector rock"
- "Mark the onboarding guide milestone as done"
- "Set up my Bloom Growth credentials"
