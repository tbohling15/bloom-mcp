# bloom-mcp

MCP server for [Bloom Growth](https://www.bloomgrowth.com/) — update metrics, check scorecards, and manage rocks directly from Claude.

## Tools

| Tool | Description |
|---|---|
| `get_my_scorecard` | All your measurables with current scores |
| `list_my_measurables` | Metrics assigned to you |
| `get_measurable` | Details for one metric by ID |
| `get_score_history` | Full score history (includes week/score IDs) |
| `update_score` | Update a score by score ID |
| `update_metric_for_week` | Post a score for a specific week |
| `list_meetings` | Your Level 10 meetings |
| `get_meeting_scorecard` | Scorecard for a specific meeting |
| `get_my_rocks` | Your quarterly rocks / goals |
| `get_meeting_todos` | Open todos for a meeting |

## Requirements

- Node.js 18+
- [1Password CLI](https://developer.1password.com/docs/cli/get-started/) (`op`) signed in
- A `Bloom Growth` item in your `Employee` 1Password vault with `Email` and `Password` fields

## Install

```bash
git clone https://github.com/tbohling15/bloom-mcp.git ~/bloom-mcp
cd ~/bloom-mcp
npm install
npm run build
bash install.sh
```

The install script registers the server in both Claude Code (`~/.claude.json`) and Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`).

Restart Claude after running the installer.

## Auth

Credentials are fetched automatically from 1Password at runtime using:

```
op://Employee/Bloom Growth/Email
op://Employee/Bloom Growth/Password
```

Tokens are cached for their full TTL — no repeated logins.

Alternatively, set `BLOOM_USERNAME` and `BLOOM_PASSWORD` environment variables to bypass 1Password.

## Example prompts

- "Show me my Bloom Growth scorecard"
- "Update my [metric name] score to [value] for this week"
- "List my quarterly rocks in Bloom"
- "What todos are open for my leadership meeting?"
