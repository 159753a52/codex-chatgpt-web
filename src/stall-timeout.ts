/**
 * Bridge upstream stall budget: seconds of silence (no adapter events) before the
 * Responses bridge emits `response.incomplete` / `upstream_stall_timeout`.
 *
 * Set to 10 minutes so a hung browser/WebSocket turn is detected and surfaced
 * within a realistic window, rather than waiting for the full turn timeout.
 */
export const DEFAULT_STALL_TIMEOUT_SEC = 600;

// Keep a malformed or accidentally enormous configuration within a practical recovery budget.
export const MAX_STALL_TIMEOUT_SEC = 3_600;

/**
 * Resolve the effective bridge stall deadline for a turn.
 * - unset / non-finite config → {@link DEFAULT_STALL_TIMEOUT_SEC}
 * - finite config → ceil, clamped to the practical [1, {@link MAX_STALL_TIMEOUT_SEC}] range
 */
export function resolveStallTimeoutSec(configuredSec: number | undefined): number {
  if (typeof configuredSec === "number" && Number.isFinite(configuredSec)) {
    return Math.min(MAX_STALL_TIMEOUT_SEC, Math.max(1, Math.ceil(configuredSec)));
  }
  return DEFAULT_STALL_TIMEOUT_SEC;
}
