import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TurnBroker } from "../src/adapters/chatgpt-web/turn-broker";
import { defaultBrokerEndpoint } from "../src/config";

test("native MCP returns task IDs, rejects wrong-session reports and persists exact completion", async () => {
  const root = mkdtempSync(join(tmpdir(), "task-queue-mcp-"));
  const dir = join(root, "sessions", "sess_test");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "meta.json"), '{"id":"sess_test"}');
  writeFileSync(join(dir, "TASKS.txt"), 'first|Question one\nsecond|Question two\n');
  const socketPath = defaultBrokerEndpoint(root);
  const broker = TurnBroker.forSocket(socketPath);
  const client = new Client({ name: "task-queue-test", version: "1" });
  const transport = new StdioClientTransport({ command: process.execPath,
    args: ["src/cli.ts", "mcp", "--contract", "native", "--broker-socket", socketPath],
    cwd: process.cwd(), stderr: "pipe" });
  try {
    const token = await broker.register({ cwd: dir, roots: [dir], writableRoots: [dir],
      sandboxPolicy: { type: "dangerFullAccess" }, tools: [] });
    await client.connect(transport);
    const call = (args: Record<string, unknown>) => client.callTool({ name: "codex_fetch_next_task", arguments: { turn_token: token, ...args } });
    const first = await call({ step_summary: "Idle" });
    expect(first.isError).not.toBe(true);
    expect(first.structuredContent).toMatchObject({ task_id: "first", next_task: "Question one" });
    expect((await call({ session_id: "wrong", task_id: "first", response_text: "42" })).isError).toBe(true);
    const done = await call({ task_id: "first", response_text: "42", step_summary: "Done" });
    expect(done.isError).not.toBe(true);
    expect(done.structuredContent).toMatchObject({ task_id: "second" });
    expect(JSON.parse(readFileSync(join(dir, "results", "first.json"), "utf8"))).toMatchObject({ state: "completed", response: "42" });
    writeFileSync(join(dir, ".stop_requested"), String(Date.now()));
    const stopped = await call({ step_summary: "Idle" });
    expect(stopped.structuredContent).toMatchObject({ has_next: false });
    expect(JSON.parse(readFileSync(join(dir, "results", "second.json"), "utf8"))).toMatchObject({ state: "cancelled" });
  } finally {
    await client.close();
    await transport.close();
    await broker.close();
    rmSync(root, { recursive: true, force: true });
  }
}, 20000);
