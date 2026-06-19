#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { execSync } from "child_process";
import { z } from "zod";

const BASE_URL = "https://app.bloomgrowth.com/api/v1";

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
    userName = process.env.BLOOM_USERNAME;
    password = process.env.BLOOM_PASSWORD;
  } else {
    // Fetch from 1Password
    userName = execSync('op read "op://Employee/Bloom Growth/Email"', { encoding: "utf8" }).trim();
    password = execSync('op read "op://Employee/Bloom Growth/Password"', { encoding: "utf8" }).trim();
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

// ---- Start ----

const transport = new StdioServerTransport();
await server.connect(transport);
