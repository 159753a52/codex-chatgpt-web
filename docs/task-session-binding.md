# Task session binding

Task queue routing is independent of the UI's `.active_session` and `.workspace_pointer`.
The automatic launcher must start Codex with `--cd <workspace>/sessions/<sessionId>`.
The MCP server uses the native turn environment's cwd to bind task reads, heartbeats,
and reports to that existing directory. It rejects a conflicting `session_id` before
touching a queue. Restarting MCP reconstructs automatic bindings from the same cwd.

Manual launches must use either the session directory or the workspace root. From
the root, the first call must explicitly supply `session_id`; missing, invalid, or
unknown IDs fail instead of falling back to another session. An established turn
cannot switch sessions. Create the session through 6pro-agent before launching.

Submit completed reports with `codex_fetch_next_task(response_text=..., step_summary="Done")`.
The server appends to the bound directory's `RESPONSE.md`. `Idle` and `Poll` do not
complete an active task. Ordinary filesystem tools remain available for development;
this routing contract is not a filesystem sandbox.

## Deferred validation and activation

At the user's request, this change was not built, tested, or deployed to running services.
The regression test is `bun test tests/task-session.test.ts`; it creates temporary
directories and does not contact a browser or model. Also run `bun run typecheck`.

Update 6pro-agent together with the gateway. Rebuild the runtime and restart the
gateway/MCP and 6pro-agent only after ongoing sessions may safely be interrupted.
Existing deployed bundles continue running the old implementation until then.

For the later live check, create A and B with distinct task markers. Launch both,
switch the UI selection while they connect, and confirm each queue, heartbeat, and
report stays in its own directory. Repeat after an MCP restart. A missing or mismatched
ID must produce an error without consuming another session's queue. Verify a failed
report append leaves the active task available, and a reconnect with `Idle` does not
complete it. Live multi-session behavior remains unverified until this check is run.
