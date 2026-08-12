# Updating bloom-mcp

Instructions for pulling the latest changes from the repo and verifying the server still runs.

## 1. Pull the latest changes

```bash
cd ~/bloom-mcp
git pull
```

## 2. Reinstall dependencies and rebuild

Only needed if `package.json` or `src/` changed (safe to always run):

```bash
npm install
npm run build
```

## 3. Verify the server responds

This does **not** re-register anything with Claude — it just confirms the built server starts and responds correctly. Claude/Perplexity spawn their own copy of this process; you don't need to keep this running for them to work.

```bash
BLOOM_USERNAME="you@example.com" BLOOM_PASSWORD="yourpassword" bash start.sh
```

A healthy response looks like:

```json
{"result":{"protocolVersion":"2025-11-25","capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"bloom-growth","version":"1.0.0"}},"jsonrpc":"2.0","id":1}
```

The process then exits — that's expected for a stdio server once its input stream closes, not a crash.

If you're using 1Password or a saved local credentials file instead of env vars, you can omit `BLOOM_USERNAME`/`BLOOM_PASSWORD` entirely:

```bash
bash start.sh
```

## 4. Restart your MCP client

The running Claude Desktop / Claude Code / Perplexity process is still using the **old** build from before your `git pull`. Fully quit and reopen it so it re-spawns the server with the updated code.

- **Claude Desktop:** Cmd+Q, then reopen
- **Claude Code:** exit the CLI session and start a new one
- **Perplexity Computer:** quit and relaunch

## 5. Confirm the update took effect

Once restarted, ask your AI client:

> "Check my Bloom Growth credentials"

This calls the `check_credentials` tool and confirms which auth source is active and that the connection works. If new tools were added in the update, you can also ask:

> "What Bloom Growth tools do you have available?"

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `git pull` fails with local changes | Run `git status` to see what changed locally, then `git stash` before pulling if you don't need those changes |
| `npm run build` fails | Delete `node_modules` and `dist`, then re-run `npm install && npm run build` |
| Tools still look outdated after restart | Fully quit the app (not just close the window) — a hidden background process may still be holding the old build |
| `start.sh` hangs instead of printing a response | Press Ctrl+C — this can happen if credentials are invalid and the server is retrying; check your email/password |
