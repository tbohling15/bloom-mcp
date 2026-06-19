# bloom-mcp

MCP server for [Bloom Growth](https://www.bloomgrowth.com/) — update metrics, check scorecards, and manage rocks directly from Claude.

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **1Password CLI** — [install guide](https://developer.1password.com/docs/cli/get-started/), must be signed in with `op signin`
- **Claude Code CLI** and/or **Claude Desktop**
- A `Bloom Growth` item in your `Employee` 1Password vault with `Email` and `Password` fields

## Install

```bash
git clone https://github.com/tbohling15/bloom-mcp.git ~/bloom-mcp
cd ~/bloom-mcp
npm install
npm run build
bash install.sh
```

The installer will:
- Check Node.js and 1Password CLI are present
- Verify your Bloom credentials in 1Password
- Build the server
- Register `bloom-growth` in Claude Code (`~/.claude.json`) and Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`)

Restart Claude after running the installer.

## Auth

Credentials are fetched automatically from 1Password at runtime:

```
op://Employee/Bloom Growth/Email
op://Employee/Bloom Growth/Password
```

Tokens are cached for their full TTL — no repeated logins. To verify your 1Password item is set up correctly:

```bash
op read "op://Employee/Bloom Growth/Email"
op read "op://Employee/Bloom Growth/Password"
```

Both commands should print a value. If either fails, open 1Password and create an item named `Bloom Growth` in the `Employee` vault with your Bloom login credentials.

Alternatively, set `BLOOM_USERNAME` and `BLOOM_PASSWORD` environment variables to bypass 1Password entirely.

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
| `get_meeting_todos` | Open todos for a meeting |

## Example prompts

Once installed, try these in Claude:

- "Show me my Bloom Growth scorecard"
- "List my measurables in Bloom"
- "Update my [metric name] score to [value] for this week in Bloom Growth"
- "List my quarterly rocks in Bloom"
- "What todos are open for my leadership meeting?"

## Install via Claude Code

Team members can also paste this into a Claude Code session and let Claude run the setup:

```
Please set up the Bloom Growth MCP server for me. Here's what to do:

1. Run the install script at ~/Downloads/bloom-mcp/install.sh (adjust this path to wherever I saved the bloom-mcp folder)
2. The script will check for Node.js and 1Password CLI, verify my Bloom credentials in 1Password, build the server, and register it in my Claude config
3. After it finishes, confirm the setup worked and tell me what prompts I can use

Go ahead and run it now.
```

Update the path in step 1 to wherever the `bloom-mcp` folder was saved.
