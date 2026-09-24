import { existsSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import type { CodexMessage } from "../../types";

export interface TaskSession {
  sessionId: string;
  directory: string;
}

function sessionId(value: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)
    || /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$/i.test(value)) {
    throw new Error("Invalid task session ID; refusing to select another session");
  }
  return value;
}

function isTaskSessionDirectory(cwd: string): boolean {
  if (!isAbsolute(cwd)) return false;
  const nativeCwd = resolve(cwd);
  return basename(dirname(nativeCwd)).toLowerCase() === "sessions" && existsSync(join(nativeCwd, "meta.json"));
}

function latestUserText(messages: readonly CodexMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]!;
    if (message.role !== "user") continue;
    return typeof message.content === "string"
      ? message.content
      : message.content.map(part => part.type === "text" ? part.text : "").join("\n");
  }
  return "";
}

/**
 * Queue-loop prompting applies only to a turn bound to a 6pro session: Codex was started in
 * <workspace>/sessions/<id>, or (manual workspace-root launch) the human's latest message is a
 * launch prompt naming an explicit session. Merely mentioning the tool elsewhere in the history,
 * such as in tool output or while discussing this code, must not redirect an ordinary turn.
 */
export function usesTaskQueue(cwd: string | undefined, messages: readonly CodexMessage[]): boolean {
  if (cwd && isTaskSessionDirectory(cwd)) return true;
  return /codex_fetch_next_task\s*\(\s*session_id\s*=\s*["']?[a-zA-Z0-9_-]+/.test(latestUserText(messages));
}

// The native turn's cwd is supplied by the CLI, independently of UI selection or model text.
// Automatic launches use <workspace>/sessions/<id>; manual launches must supply an explicit ID.
export function bindTaskSession(cwd: string, requested?: string | null, bound?: TaskSession): TaskSession {
  const explicit = requested == null ? undefined : sessionId(requested);
  if (bound) {
    if (explicit && explicit !== bound.sessionId) throw new Error("Task session mismatch: cannot rebind an active turn");
    return bound;
  }
  if (!isAbsolute(cwd)) throw new Error("Task session requires an absolute native cwd");
  const nativeCwd = resolve(cwd);
  const sessionCwd = basename(dirname(nativeCwd)).toLowerCase() === "sessions";
  const id = sessionCwd ? sessionId(basename(nativeCwd)) : explicit;
  if (!id) throw new Error("Missing task session binding: launch in the session directory or supply session_id from the workspace root");
  if (explicit && explicit !== id) throw new Error("Task session mismatch with native cwd");
  const directory = sessionCwd ? nativeCwd : join(nativeCwd, "sessions", id);
  if (!existsSync(join(directory, "meta.json"))) throw new Error("Task session does not exist; create it before starting the turn");
  return { sessionId: id, directory: realpathSync(directory) };
}
