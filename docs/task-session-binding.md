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

Submit completed reports with `codex_fetch_next_task(task_id=..., response_text=..., step_summary="Done")`.
Use the exact ID returned when claiming the task. Protocol 3 stores a durable result
for that ID; status words alone do not complete a task. Duplicate identical results
are safe to retry. All task operations share `.pop_lock` with the 6pro-agent service.
The server appends to the bound directory's `RESPONSE.md`. `Idle` and `Poll` do not
complete an active task. Ordinary filesystem tools remain available for development;
this routing contract is not a filesystem sandbox.

Queue-loop prompt instructions are added only when the turn's cwd is a session directory, or
when the human's latest message is a launch prompt naming `codex_fetch_next_task(session_id=...)`.
Mentioning the tool elsewhere (tool output, code review) leaves an ordinary turn unchanged.
`codex_fetch_next_task` is a top-level MCP tool and is not listed in `codex_tool_inventory`.
Adding it changed the public connector ABI hash, so refresh the ChatGPT connector after upgrading.

A new turn that finds a silent turn's unfinished claim keeps polling (`__POLL__`) instead of
failing; after the user resets the worker in 6pro-agent it takes the requeued task. A stop aimed
at the silent turn is acknowledged on its behalf and the new turn keeps serving.

## Deferred validation and activation

Offline validation now includes `bun test tests/task-session.test.ts tests/task-queue-mcp.test.ts`
and `bun x --no-install tsc --noEmit`. The MCP test uses a local stdio client and
broker with temporary session directories; it does not contact a browser or model.
No deployed runtime was rebuilt or restarted.

The identical `task-store.cjs` is shipped here and in 6pro-agent's `lib/` directory.
Update both copies together. The service, CLI and running MCP worker must all use
protocol 3. Legacy unfinished tasks without IDs must be stopped before migration.
An expired heartbeat is uncertain liveness, not proof that a task has stopped.

Update 6pro-agent together with the gateway. Rebuild the runtime and restart the
gateway/MCP and 6pro-agent only after ongoing sessions may safely be interrupted.
Existing deployed bundles continue running the old implementation until then.

For the later live check, create A and B with distinct task markers. Launch both,
switch the UI selection while they connect, and confirm each queue, heartbeat, and
report stays in its own directory. Repeat after an MCP restart. A missing or mismatched
ID must produce an error without consuming another session's queue. Verify a failed
report append leaves the active task available, and a reconnect with `Idle` does not
complete it. Live multi-session behavior remains unverified until this check is run.
