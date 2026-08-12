#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { execSync } from "child_process";
import { z } from "zod";
import fs from "fs";
import path from "path";
import os from "os";
import http from "http";

const BASE_URL = "https://app.bloomgrowth.com/api/v1";
const CREDENTIALS_DIR = path.join(os.homedir(), ".bloom-mcp");
const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, "credentials.json");

// ---- Credential storage ----

interface StoredCredentials {
  username: string;
  password: string;
}

function loadStoredCredentials(): StoredCredentials | null {
  try {
    if (!fs.existsSync(CREDENTIALS_FILE)) return null;
    const raw = fs.readFileSync(CREDENTIALS_FILE, "utf8");
    const parsed = JSON.parse(raw) as StoredCredentials;
    if (parsed.username && parsed.password) return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveCredentials(username: string, password: string): void {
  if (!fs.existsSync(CREDENTIALS_DIR)) {
    fs.mkdirSync(CREDENTIALS_DIR, { recursive: true });
  }
  fs.writeFileSync(
    CREDENTIALS_FILE,
    JSON.stringify({ username, password }, null, 2),
    { mode: 0o600 }
  );
}

function clearCredentials(): void {
  if (fs.existsSync(CREDENTIALS_FILE)) {
    fs.unlinkSync(CREDENTIALS_FILE);
  }
}

// ---- Auth ----

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  let userName: string;
  let password: string;

  if (process.env.BLOOM_USERNAME && process.env.BLOOM_PASSWORD) {
    // 1. Environment variables (highest priority)
    userName = process.env.BLOOM_USERNAME;
    password = process.env.BLOOM_PASSWORD;
  } else {
    const stored = loadStoredCredentials();
    if (stored) {
      // 2. Local credentials file (~/.bloom-mcp/credentials.json)
      userName = stored.username;
      password = stored.password;
    } else {
      // 3. 1Password CLI fallback
      try {
        userName = execSync('op read "op://Employee/Bloom Growth/Email"', { encoding: "utf8" }).trim();
        password = execSync('op read "op://Employee/Bloom Growth/Password"', { encoding: "utf8" }).trim();
      } catch {
        throw new Error(
          "No Bloom credentials found. Run the setup tool in Claude: " +
          "\"Set up my Bloom Growth credentials\" — or set BLOOM_USERNAME and BLOOM_PASSWORD env vars."
        );
      }
    }
  }

  const body = new URLSearchParams({
    grant_type: "password",
    userName,
    password,
  });

  const res = await fetch("https://app.bloomgrowth.com/Token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Bloom auth failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return cachedToken.value;
}

async function bloomFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Bloom API error ${res.status}: ${await res.text()}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ---- Server ----

const server = new McpServer({
  name: "bloom-growth",
  version: "1.0.0",
});

// 1. Get my scorecard (all measurables + current scores)
server.tool(
  "get_my_scorecard",
  "Get your Bloom Growth scorecard — all measurables with their current week scores and goals.",
  {},
  async () => {
    const data = await bloomFetch("/scorecard/user/mine");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// 2. Get measurable details
server.tool(
  "get_measurable",
  "Get details for a specific measurable (metric) by its ID.",
  { measurable_id: z.string().describe("The measurable ID") },
  async ({ measurable_id }) => {
    const data = await bloomFetch(`/measurables/${measurable_id}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// 3. Get my measurables list
server.tool(
  "list_my_measurables",
  "List all measurables (metrics) assigned to you.",
  {},
  async () => {
    const data = await bloomFetch("/measurables/user/mine");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// 4. Update a score by score ID
server.tool(
  "update_score",
  "Update the value of a score by its score ID. Use get_score_history to find score IDs.",
  {
    score_id: z.string().describe("The score ID to update"),
    value: z.number().describe("The numeric value to set"),
    note: z.string().optional().describe("Optional note for this score entry"),
  },
  async ({ score_id, value, note }) => {
    const body: Record<string, unknown> = { value };
    if (note) body.note = note;
    const data = await bloomFetch(`/scores/${score_id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// 5. Update metric score for a specific week
server.tool(
  "update_metric_for_week",
  "Post or update a metric score for a specific week. Provide the measurable ID and week ID. Use get_score_history to find week IDs.",
  {
    measurable_id: z.string().describe("The measurable ID"),
    week_id: z.string().describe("The week ID"),
    value: z.number().describe("The numeric value to set"),
    note: z.string().optional().describe("Optional note"),
  },
  async ({ measurable_id, week_id, value, note }) => {
    const body: Record<string, unknown> = { value };
    if (note) body.note = note;
    const data = await bloomFetch(`/measurables/${measurable_id}/week/${week_id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// 6. Get score history for a measurable
server.tool(
  "get_score_history",
  "Get the full score history for a measurable. Returns score IDs and week IDs needed for updates.",
  { measurable_id: z.string().describe("The measurable ID") },
  async ({ measurable_id }) => {
    const data = await bloomFetch(`/measurables/${measurable_id}/scores`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// 7. List L10 meetings
server.tool(
  "list_meetings",
  "List all your Level 10 (L10) meetings.",
  {},
  async () => {
    const data = await bloomFetch("/L10/list");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// 8. Get meeting scorecard
server.tool(
  "get_meeting_scorecard",
  "Get the scorecard for a specific L10 meeting.",
  { meeting_id: z.string().describe("The L10 meeting ID") },
  async ({ meeting_id }) => {
    const data = await bloomFetch(`/scorecard/meeting/${meeting_id}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// 9. Get my rocks
server.tool(
  "get_my_rocks",
  "List your current quarterly rocks (goals).",
  {},
  async () => {
    const data = await bloomFetch("/rocks/user/mine");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// 10. Get todos for a meeting
server.tool(
  "get_meeting_todos",
  "List open todos for a specific L10 meeting.",
  { meeting_id: z.string().describe("The L10 meeting ID") },
  async ({ meeting_id }) => {
    const data = await bloomFetch(`/l10/${meeting_id}/todos`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ---- Todo notes helper ----

function bloomMeetingTodosUrl(meetingId: string): string {
  return `https://static.bloomgrowth.com/meetings/${meetingId}?tab=MEETING&pageType=TODOS`;
}

async function getTodoNoteText(todoId: number | string): Promise<string> {
  try {
    const noteMeta = (await bloomFetch(`/todo/notes/${todoId}`)) as { URL?: string } | null;
    if (!noteMeta?.URL) return "";
    const match = noteMeta.URL.match(/\/p\/([a-f0-9-]+)/i);
    if (!match) return "";
    const padId = match[1];
    const res = await fetch(`https://notes2.bloomgrowth.com/p/${padId}/export/txt`);
    if (!res.ok) return "";
    return (await res.text()).trim();
  } catch {
    return "";
  }
}

// 10b. Get notes for a single todo
server.tool(
  "get_todo_notes",
  "Get the notes/details text attached to a specific todo. Returns plain text extracted from the todo's notepad.",
  { todo_id: z.string().describe("The todo ID") },
  async ({ todo_id }) => {
    const notes = await getTodoNoteText(todo_id);
    return { content: [{ type: "text", text: notes || "(no notes)" }] };
  }
);

// 10c. Get todos with notes attached — designed for Slack/automation exports
server.tool(
  "get_meeting_todos_with_notes",
  "List all open todos for a meeting, each enriched with its notes text, and a single top-level link to the meeting's todo list in the current Bloom Growth UI (not the legacy per-todo links). Ideal for posting a todo digest to Slack.",
  { meeting_id: z.string().describe("The L10 meeting ID"), include_closed: z.boolean().optional().describe("Include completed todos (default: false)") },
  async ({ meeting_id, include_closed }) => {
    const query = include_closed ? "?INCLUDE_CLOSED=true" : "";
    const todos = (await bloomFetch(`/l10/${meeting_id}/todos${query}`)) as Array<Record<string, unknown>>;

    const enriched = await Promise.all(
      todos.map(async (t) => ({
        id: t.Id,
        title: t.Name,
        owner: (t.Owner as { Name?: string } | undefined)?.Name ?? null,
        dueDate: t.DueDate,
        status: t.Complete ? "Complete" : "Open",
        notes: await getTodoNoteText(t.Id as number),
      }))
    );

    const result = {
      meetingListUrl: bloomMeetingTodosUrl(meeting_id),
      todos: enriched,
    };

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// 11. Get a single rock by ID (includes status, completion, results)
server.tool(
  "get_rock",
  "Get full details for a specific rock by ID, including status, completion percentage, and results so far.",
  { rock_id: z.string().describe("The rock ID") },
  async ({ rock_id }) => {
    const data = await bloomFetch(`/rocks/${rock_id}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// 12. Get rocks for a specific user (useful for managers viewing their team)
server.tool(
  "get_user_rocks",
  "Get rocks for a specific user by their user ID. Use get_my_rocks first to find user IDs.",
  { user_id: z.string().describe("The user ID") },
  async ({ user_id }) => {
    const data = await bloomFetch(`/rocks/user/${user_id}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// 13. Update a rock (status, completion, title)
server.tool(
  "update_rock",
  "Update a rock's status, completion percentage, or title. Status values: 'OnTrack', 'OffTrack', 'Done', 'Unknown'. Completion is 0–100.",
  {
    rock_id: z.string().describe("The rock ID"),
    title: z.string().optional().describe("Updated rock title"),
    status: z.enum(["OnTrack", "OffTrack", "Done", "Unknown"]).optional().describe("Rock status"),
    completion: z.number().min(0).max(100).optional().describe("Completion percentage (0-100)"),
  },
  async ({ rock_id, title, status, completion }) => {
    const body: Record<string, unknown> = {};
    if (title !== undefined) body.title = title;
    if (status !== undefined) body.status = status;
    if (completion !== undefined) body.completion = completion;
    const data = await bloomFetch(`/rocks/${rock_id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// 14. Get milestones for a rock
server.tool(
  "get_rock_milestones",
  "List all milestones (plan steps) for a specific rock. Milestones are the bullet points under 'Plan & Milestones' on a rock card.",
  { rock_id: z.string().describe("The rock ID") },
  async ({ rock_id }) => {
    const data = await bloomFetch(`/rocks/${rock_id}/milestones`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// 15. Add a milestone to a rock
server.tool(
  "add_rock_milestone",
  "Add a new milestone (plan step) to a rock. Milestones appear as bullet points under 'Plan & Milestones' on the rock card.",
  {
    rock_id: z.string().describe("The rock ID"),
    title: z.string().describe("The milestone description, e.g. 'Define customer Day 1-30 activation milestones'"),
    due_date: z.string().optional().describe("Due date in ISO 8601 format, e.g. '2026-09-30T00:00:00'"),
    status: z.enum(["NotDone", "Done"]).optional().describe("Milestone completion status (default: NotDone)"),
  },
  async ({ rock_id, title, due_date, status }) => {
    const body: Record<string, unknown> = { title };
    if (due_date !== undefined) body.dueDate = due_date;
    if (status !== undefined) body.status = status;
    const data = await bloomFetch(`/rocks/${rock_id}/milestones`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ---- Credential management tools ----

server.tool(
  "setup_credentials",
  "Save your Bloom Growth username (email) and password locally so you don't need 1Password or env vars. Credentials are stored in ~/.bloom-mcp/credentials.json with owner-only permissions (chmod 600). Run this once to get started.",
  {
    username: z.string().describe("Your Bloom Growth login email"),
    password: z.string().describe("Your Bloom Growth password"),
  },
  async ({ username, password }) => {
    // Verify credentials work before saving
    const body = new URLSearchParams({ grant_type: "password", userName: username, password });
    const res = await fetch("https://app.bloomgrowth.com/Token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      return {
        content: [{
          type: "text",
          text: `Login failed — credentials not saved. Check your email and password and try again. (${res.status})`,
        }],
      };
    }

    saveCredentials(username, password);

    // Prime the token cache
    const data = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };

    return {
      content: [{
        type: "text",
        text: `Credentials verified and saved to ${CREDENTIALS_FILE} (permissions: 600). You're ready to use Bloom Growth tools.`,
      }],
    };
  }
);

server.tool(
  "check_credentials",
  "Show which credential source is currently active (env vars, local file, or 1Password) and confirm the connection works.",
  {},
  async () => {
    let source: string;

    if (process.env.BLOOM_USERNAME && process.env.BLOOM_PASSWORD) {
      source = "Environment variables (BLOOM_USERNAME / BLOOM_PASSWORD)";
    } else if (loadStoredCredentials()) {
      source = `Local credentials file (${CREDENTIALS_FILE})`;
    } else {
      source = "1Password CLI (op://Employee/Bloom Growth)";
    }

    try {
      await getToken();
      return { content: [{ type: "text", text: `Connected ✓\nCredential source: ${source}` }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Connection failed.\nCredential source attempted: ${source}\nError: ${err}` }] };
    }
  }
);

server.tool(
  "clear_credentials",
  "Remove locally stored Bloom Growth credentials from ~/.bloom-mcp/credentials.json.",
  {},
  async () => {
    clearCredentials();
    cachedToken = null;
    return { content: [{ type: "text", text: `Credentials cleared from ${CREDENTIALS_FILE}.` }] };
  }
);

// ---- Start ----

const useHttp = process.argv.includes("--http") || process.env.BLOOM_MCP_TRANSPORT === "http";

if (useHttp) {
  const port = Number(process.env.BLOOM_MCP_PORT ?? 8420);
  const host = "127.0.0.1"; // localhost-only — never bind to 0.0.0.0

  const httpServer = http.createServer(async (req, res) => {
    if (req.url !== "/mcp") {
      res.writeHead(404).end("Not found");
      return;
    }
    // Stateless mode: a fresh transport per request, no session persistence needed
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      const parsedBody = body ? JSON.parse(body) : undefined;
      await transport.handleRequest(req, res, parsedBody);
    });
  });

  httpServer.listen(port, host, () => {
    console.error(`bloom-mcp listening on http://${host}:${port}/mcp (localhost only)`);
  });
} else {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
