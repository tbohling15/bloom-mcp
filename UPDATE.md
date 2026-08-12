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

How you restart depends on how you connect — pick the section that matches your setup.

### If you use Claude Desktop or Claude Code (stdio — spawned automatically)

The running process is still using the **old** build from before your `git pull`. Fully quit and reopen so it re-spawns the server with the updated code.

- **Claude Desktop:** Cmd+Q, then reopen
- **Claude Code:** exit the CLI session and start a new one

### If you use Perplexity Computer (or any URL-based connector — HTTP mode)

This server doesn't get spawned automatically — you're running it yourself in the background. Find and stop the old process, then start it again with the new build:

```bash
# Find the running process
lsof -iTCP:8420 -sTCP:LISTEN -P

# Kill it (replace PID with the number from the command above)
kill <PID>

# Start it again with the updated code
BLOOM_USERNAME="you@example.com" BLOOM_PASSWORD="yourpassword" BLOOM_MCP_TRANSPORT=http node ~/bloom-mcp/dist/index.js
```

Keep this running in a terminal tab, or see the note at the bottom about keeping it alive across reboots. No changes are needed in Perplexity's connector settings — the address (`http://127.0.0.1:8420/mcp`) stays the same across updates.

## 5. Confirm the update took effect

**Claude Desktop / Claude Code:** ask your AI client:

> "Check my Bloom Growth credentials"

This calls the `check_credentials` tool and confirms which auth source is active and that the connection works. If new tools were added in the update, you can also ask:

> "What Bloom Growth tools do you have available?"

**Perplexity Computer (HTTP mode):** confirm the server responds on its address:

```bash
curl -s -X POST http://127.0.0.1:8420/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2026-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

A healthy response includes `"serverInfo":{"name":"bloom-growth", ...}`. Then ask Perplexity the same questions as above to confirm the tools are working end-to-end.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `git pull` fails with local changes | Run `git status` to see what changed locally, then `git stash` before pulling if you don't need those changes |
| `npm run build` fails | Delete `node_modules` and `dist`, then re-run `npm install && npm run build` |
| Tools still look outdated after restart | Fully quit the app (not just close the window) — a hidden background process may still be holding the old build |
| `start.sh` hangs instead of printing a response | Press Ctrl+C — this can happen if credentials are invalid and the server is retrying; check your email/password |
| `lsof -iTCP:8420` shows nothing | The HTTP server isn't running — start it with the command in step 4's Perplexity section |
| `EADDRINUSE` error when starting HTTP mode | An old copy is still running on that port — find and `kill` it first (see step 4), or use a different port with `BLOOM_MCP_PORT=9000` |
| Perplexity still shows old tools after update | You restarted the HTTP process but Perplexity itself may need a manual reconnect — check its connector settings and re-save the address if needed |
