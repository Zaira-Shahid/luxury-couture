#!/usr/bin/env node
// Module 43 — a stdio transport for external MCP clients.
//
// WHAT THIS IS: a pipe. It reads newline-delimited JSON-RPC from stdin,
// POSTs each message to this application's /api/mcp endpoint, and writes
// the reply to stdout. That is the whole program.
//
// WHY IT IS A PROXY AND NOT A SECOND SERVER. The obvious alternative is
// to import the registry into this process and call `handleJsonRpc()`
// directly — no HTTP hop, faster, fewer moving parts. It was rejected:
// that would be a second execution path with its own copy of
// authentication, rate limiting and audit, and the reviewed one is the
// route. Two security models, one of them reviewed, is how a gap gets in.
// Everything this transport can do, it does by asking the same endpoint a
// browser asks, and a change to the route governs both.
//
// AUTHENTICATION (12B.3). The endpoint is session-bound: there is no MCP
// API key and no service account, so this needs a real user's access
// token, supplied as MCP_ACCESS_TOKEN. It is a Supabase access token,
// which means it EXPIRES — typically within the hour — and this process
// does not refresh it, because refreshing would mean holding the refresh
// token, and a long-lived credential sitting in a desktop client's
// config is the thing session-binding exists to avoid. When it expires,
// calls come back UNAUTHORIZED and a new token is needed. That is a real
// limitation and it is stated here rather than worked around.
//
// Usage, e.g. in a desktop MCP client's config:
//
//   {
//     "command": "node",
//     "args": ["scripts/mcp-stdio.mjs"],
//     "env": { "MCP_URL": "https://…/api/mcp", "MCP_ACCESS_TOKEN": "…" }
//   }
//
// Get a token by signing in as the staff account you want it to act as:
//   node --env-file=.env.local scripts/mcp-stdio.mjs --token you@example.com
// which prints one and exits, prompting for the password on stdin.

import { createInterface } from "node:readline";
import { stdin, stdout, stderr, argv, env, exit } from "node:process";

const MCP_URL = env.MCP_URL ?? `${env.APP_URL ?? "http://localhost:3000"}/api/mcp`;
const REQUEST_TIMEOUT_MS = 120_000;

/** Everything this process says about itself goes to stderr: stdout is the protocol. */
function note(message) {
  stderr.write(`${message}\n`);
}

// ---------------------------------------------------------------------
// --token: print an access token for a staff account and exit.
//
// A convenience, not part of the transport. It exists because the
// alternative is telling someone to dig a JWT out of browser devtools,
// which is how tokens end up pasted into places they should not be.
// ---------------------------------------------------------------------
if (argv[2] === "--token") {
  const email = argv[3];
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!email || !url || !anonKey) {
    note("usage: node --env-file=.env.local scripts/mcp-stdio.mjs --token you@example.com");
    exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const rl = createInterface({ input: stdin, output: stderr, terminal: true });
  const password = await new Promise((resolve) => rl.question("Password: ", resolve));
  rl.close();

  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    note(`Sign-in failed: ${error.message}`);
    exit(1);
  }
  // stdout, so it can be piped into a config; the warning goes to stderr.
  note("This token expires (usually within the hour) and is not refreshed by the adapter.");
  stdout.write(`${data.session.access_token}\n`);
  exit(0);
}

// ---------------------------------------------------------------------
// The transport.
// ---------------------------------------------------------------------

const token = env.MCP_ACCESS_TOKEN;
if (!token) {
  note("MCP_ACCESS_TOKEN is not set. Get one with: scripts/mcp-stdio.mjs --token you@example.com");
  exit(1);
}

/**
 * Forwards one message and returns the reply, or null when there is none.
 *
 * A NOTIFICATION GETS NO REPLY, and the route says so with a 202 and an
 * empty body. Writing anything to stdout for one would be a protocol
 * violation that a client reads as an unsolicited response to whatever it
 * asked next.
 *
 * A TRANSPORT FAILURE IS REPORTED AS ONE. The client is told the server
 * could not be reached, in JSON-RPC's own error shape, rather than being
 * left waiting — a silent drop looks identical to a slow tool, and the
 * assistant on the other end will wait for it.
 */
async function forward(message) {
  let response;
  try {
    response = await fetch(MCP_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (message.id === undefined || message.id === null) return null;
    return {
      jsonrpc: "2.0",
      id: message.id,
      error: { code: -32603, message: `Could not reach the MCP endpoint: ${error.message}` },
    };
  }

  if (response.status === 202) return null;

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // An HTML error page from a proxy, most likely. Passing it through as
    // stdout would corrupt the stream the client is parsing.
    return {
      jsonrpc: "2.0",
      id: message.id ?? null,
      error: { code: -32603, message: `Unexpected non-JSON reply (HTTP ${response.status}).` },
    };
  }
}

const lines = createInterface({ input: stdin, crlfDelay: Infinity });

for await (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed) continue;

  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    stdout.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error." },
      })}\n`
    );
    continue;
  }

  // Messages are forwarded ONE AT A TIME, in order. An MCP client can
  // pipeline, and answering out of order is legal — but the endpoint
  // rate-limits per actor, and firing a burst at it would throttle the
  // very client this transport exists to serve.
  const reply = await forward(message);
  if (reply !== null) stdout.write(`${JSON.stringify(reply)}\n`);
}
