import type { ToolCall, SecurityConfig } from '../types.js';

/**
 * Determine if a tool call needs user confirmation based on security mode.
 *
 * Normal mode: Smart auto-approval for safe operations, confirmation for risky ones
 * Hardcore mode: No confirmations, full auto-execution
 */
export function needsConfirm(toolCall: ToolCall, security: SecurityConfig): boolean {
  if (security.mode === 'hardcore') {
    // Hardcore mode: never ask for confirmation
    return false;
  }

  // Normal mode: classify tool calls
  switch (toolCall.name) {
    case 'bash': {
      const input = toolCall.input as Record<string, unknown>;
      const command = typeof input.command === 'string' ? input.command.trim() : '';

      return needsBashConfirm(command, security.workspaceRoot);
    }

    case 'write_file': {
      const input = toolCall.input as Record<string, unknown>;
      const path = typeof input.path === 'string' ? input.path : '';

      return needsWriteFileConfirm(path, security.workspaceRoot);
    }

    case 'read_file': {
      const input = toolCall.input as Record<string, unknown>;
      const path = typeof input.path === 'string' ? input.path : '';

      return needsReadFileConfirm(path, security.workspaceRoot);
    }

    default:
      // All other tools require confirmation in normal mode
      return true;
  }
}

function needsBashConfirm(command: string, workspaceRoot: string): boolean {
  if (!command) return false;

  // Auto-run safe commands
  const safeCommands = [
    /^pwd\s*$/,
    /^ls(\s|$)/,
    /^find\s+/,
    /^grep\s+/,
    /^cat\s+/,
    /^git\s+(status|diff|log)(\s|$)/,
    /^npm\s+(test|run\s+\w+)(\s|$)/,
    /^node\s+/,
    /^tsc(\s|$)/,
    /^python3?\s+/,
    /^mkdir\s+/,
    /^touch\s+/,
    /^cd(\s|$)/,
    /^echo\s+/,
  ];

  for (const pattern of safeCommands) {
    if (pattern.test(command)) {
      return false; // Auto-run
    }
  }

  // Ask for confirmation on risky commands
  const riskyPatterns = [
    /\brm\b/,
    /\bmv\b/,
    /\bchmod\b/,
    /\bchown\b/,
    /\b(pkg|apt|apt-get)\s+install\b/,
    /\bnpm\s+install\b/,
    /\bpip\s+install\b/,
    /\b(curl|wget)\b/,
    /\b(ssh|scp)\b/,
    /\bsudo\b/,
    /\|/, // pipes
  ];

  for (const pattern of riskyPatterns) {
    if (pattern.test(command)) {
      return true; // Needs confirmation
    }
  }

  // Default: ask for confirmation on unknown commands
  return true;
}

function needsWriteFileConfirm(path: string, workspaceRoot: string): boolean {
  // Auto-run writes inside workspace (but show compact diff in UI)
  // This function determines if confirmation dialog is shown
  // The compact diff is handled separately in the UI
  if (path.startsWith('/') && !path.startsWith(workspaceRoot)) {
    return true; // Outside workspace - needs confirmation
  }

  return false; // Inside workspace - auto-run with diff display
}

function needsReadFileConfirm(path: string, workspaceRoot: string): boolean {
  // Auto-run reads inside workspace
  if (!path.startsWith('/') || path.startsWith(workspaceRoot)) {
    // Check for sensitive patterns
    const sensitivePatterns = [
      /[/\\]\.ssh[/\\]/,
      /[/\\]\.env(\.\w+)?$/,
      /[/\\]\.config[/\\]a-llmcli[/\\]/,
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(path)) {
        return true; // Sensitive file - needs confirmation
      }
    }

    return false; // Auto-run
  }

  return true; // Outside workspace - needs confirmation
}