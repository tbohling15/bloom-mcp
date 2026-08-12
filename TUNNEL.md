# Exposing bloom-mcp to Perplexity via ngrok

Perplexity Computer's connector setup fetches your MCP server's URL from Perplexity's own infrastructure, not from your machine — so a plain `http://127.0.0.1:8420/mcp` address won't be reachable. ngrok creates a temporary public URL that tunnels back to your local server, solving that.

This is a **dev/testing tool**, not a production setup — see the caveats at the bottom before relying on it long-term.

---

## 1. Install ngrok

```bash
brew install ngrok
```

(Or download from [ngrok.com/download](https://ngrok.com/download) if you don't use Homebrew.)

## 2. Create a free ngrok account and get your authtoken

1. Sign up at [dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup) (free tier is fine)
2. Copy your authtoken from [dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Add it to your local ngrok config:

```bash
ngrok config add-authtoken YOUR_TOKEN_HERE
```

You only need to do this once per machine.

## 3. Start bloom-mcp in HTTP mode

If it's not already running:

```bash
cd ~/bloom-mcp
BLOOM_MCP_TRANSPORT=http node dist/index.js
```

Leave this running in its own terminal tab. (If you use 1Password or a saved local credentials file instead of env vars, you can drop the `BLOOM_USERNAME`/`BLOOM_PASSWORD` — just set `BLOOM_MCP_TRANSPORT=http`.)

## 4. Start the ngrok tunnel

In a **second** terminal tab:

```bash
ngrok http 8420
```

You'll see output like this:

```
Session Status                online
Forwarding                    https://abcd-1234-5678.ngrok-free.app -> http://localhost:8420
```

## 5. Enter the address in Perplexity

Take the `https://...ngrok-free.app` URL from step 4, append `/mcp`, and enter it in Perplexity's connector setup:

```
https://abcd-1234-5678.ngrok-free.app/mcp
```

Settings:
- **Auth:** None
- **Transport:** Streamable HTTP (not SSE)

## 6. Verify it worked

Before trying Perplexity, confirm the tunnel actually reaches your server:

```bash
curl -s -X POST https://abcd-1234-5678.ngrok-free.app/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2026-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

A healthy response includes `"serverInfo":{"name":"bloom-growth", ...}`.

---

## Caveats — read before relying on this

- **The URL changes every time you restart ngrok** (on the free tier). If you restart the tunnel, you must re-enter the new URL in Perplexity.
- **No auth on the tunnel** — anyone with the URL can reach your Bloom Growth account for as long as the tunnel is running. Don't share the URL outside your team, and stop the tunnel (`Ctrl+C`) when you're done testing.
- **Free tier has a request rate limit** — fine for personal testing, not for sharing with a large team.
- **Both processes must stay running** — bloom-mcp itself (step 3) and the ngrok tunnel (step 4). If either one stops, the connector breaks until you restart it.
- **This is not a permanent fix.** For a stable, always-on setup, the right move is deploying bloom-mcp as a real remote server (e.g. Cloudflare Workers) instead of tunneling a laptop. Ask if you want to move to that.

## Stopping the tunnel

```bash
# In the ngrok terminal tab
Ctrl+C
```

The bloom-mcp server itself can keep running — only the tunnel needs to stop.
