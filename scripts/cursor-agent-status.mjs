#!/usr/bin/env node
/**
 * Check status of a Cursor Cloud Agent.
 *
 * Usage:
 *   node scripts/cursor-agent-status.mjs bc-xxxxxxxx
 *   node scripts/cursor-agent-status.mjs https://cursor.com/agents/bc-xxxxxxxx
 */
import { getCloudAgent, getCursorApiKey, loadCursorEnv } from "./cursor-agent-api.mjs";

loadCursorEnv();

const raw = process.argv[2]?.trim();
if (!raw) {
  console.error("Usage: node scripts/cursor-agent-status.mjs <agent-id-or-url>");
  process.exit(1);
}

const agentId = raw.includes("/agents/") ? raw.split("/agents/").pop() : raw;

try {
  getCursorApiKey();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

try {
  const agent = await getCloudAgent(agentId);
  console.log(`id:     ${agent.id ?? agentId}`);
  console.log(`name:   ${agent.name ?? "(unknown)"}`);
  console.log(`status: ${agent.status ?? "(unknown)"}`);
  if (agent.url) console.log(`url:    ${agent.url}`);
  if (agent.createdAt) console.log(`created: ${agent.createdAt}`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
