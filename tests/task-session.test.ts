import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bindTaskSession, usesTaskQueue } from "../src/adapters/chatgpt-web/task-session";

test("task routing ignores UI selection, rejects mismatches, and survives MCP binding-map loss", () => {
  const root = mkdtempSync(join(tmpdir(), "task-session-"));
  try {
    for (const id of ["sess_a", "sess_b"]) {
      mkdirSync(join(root, "sessions", id), { recursive: true });
      writeFileSync(join(root, "sessions", id, "meta.json"), JSON.stringify({ id }));
    }
    const cwdA = join(root, "sessions", "sess_a");
    writeFileSync(join(root, ".active_session"), "sess_b");
    const a = bindTaskSession(cwdA);
    expect(a).toEqual({ sessionId: "sess_a", directory: realpathSync(cwdA) });
    const b = bindTaskSession(join(root, "sessions", "sess_b"));
    writeFileSync(join(root, ".active_session"), "sess_a");
    expect(bindTaskSession(cwdA, undefined, a)).toEqual(a);
    expect(bindTaskSession(join(root, "sessions", "sess_b"), undefined, b)).toEqual(b);
    expect(bindTaskSession(cwdA)).toEqual(a); // A fresh MCP process uses native cwd, never the UI.
    expect(() => bindTaskSession(cwdA, "sess_b")).toThrow("mismatch");
    expect(() => bindTaskSession(cwdA, "sess_b", a)).toThrow("rebind");
    expect(() => bindTaskSession(root)).toThrow("Missing task session");
    expect(bindTaskSession(root, "sess_a")).toEqual(a);
    expect(() => bindTaskSession(root, "sess_missing")).toThrow("does not exist");
    for (const invalid of ["", "../sess_a", "sess.a", "sess a", "NUL"]) {
      expect(() => bindTaskSession(root, invalid)).toThrow("Invalid");
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("queue-loop prompting needs a bound session, not a mention of the tool", () => {
  const root = mkdtempSync(join(tmpdir(), "task-queue-mode-"));
  try {
    const session = join(root, "sessions", "sess_a");
    mkdirSync(session, { recursive: true });
    writeFileSync(join(session, "meta.json"), JSON.stringify({ id: "sess_a" }));
    const user = (content: string) => ({ role: "user" as const, content, timestamp: 1 });
    const tool = (content: string) => ({ role: "toolResult" as const, toolCallId: "1", toolName: "exec", content, isError: false, timestamp: 1 });
    expect(usesTaskQueue(session, [user("anything")])).toBeTrue();
    expect(usesTaskQueue(join(root, "sessions", "missing"), [user("hi")])).toBeFalse();
    // Reviewing this code, or tool output that contains the name, is an ordinary turn.
    expect(usesTaskQueue(root, [user("review how codex_fetch_next_task works")])).toBeFalse();
    expect(usesTaskQueue(root, [user("hi"), tool('call codex_fetch_next_task(session_id="sess_a")')])).toBeFalse();
    // A manual workspace-root launch names its session explicitly in the latest user message.
    expect(usesTaskQueue(root, [user('现在请调用 codex_fetch_next_task(session_id="sess_a", step_summary="Idle")')])).toBeTrue();
    expect(usesTaskQueue(root, [user('codex_fetch_next_task(session_id="sess_a")'), user("new unrelated request")])).toBeFalse();
    expect(usesTaskQueue(undefined, [{ role: "user", content: [{ type: "text", text: 'codex_fetch_next_task(session_id="sess_a")' }], timestamp: 1 }])).toBeTrue();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
