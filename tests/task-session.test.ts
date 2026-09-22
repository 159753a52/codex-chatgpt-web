import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bindTaskSession } from "../src/adapters/chatgpt-web/task-session";

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
