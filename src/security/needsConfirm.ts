import type { ToolCall, SecurityConfig } from '../types.js';

/**
 * Sensitive path patterns reused across bash, read_file, and write_file checks.
 * Keep in sync with src/tools/readFile.ts
 */
export const SENSITIVE_PATH_PATTERNS = [
  /[/\\]\\.ssh[/\\]/,
  /[/\\]\\.env(\\.\\w+)?$/,
  /[/\\]\\.config[/\\]a-llmcli[/\\]/,
  /[/\\]\\.aws[/\\]/,
  /[/\\]\\.gitconfig$/,
  /[/\\]\\.netrc$/,
  /[/\\]config\\.yaml$/,
  /\\.pem$/,
  /\\.key$/,
];

/** Check if a path matches any sensitive pattern */
export function isSensitivePath(path: string): boolean {
  for (const pattern of SENSITIVE_PATH_PATTERNS) {
    if (pattern.test(path)) {
      return true;
    }
  }
  return false;
}

/**
 * Heuristic: does a bash command reference sensitive files or paths?
 * Looks for file paths as arguments to read/write ops (cat, echo >, etc.)
 * that hit sensitive patterns.
 */
export function bashRefsSensitivePath(command: string): boolean {
  const sensitiveIndicators = [
    /[/\\]\\.ssh[/\\]/,
    /[/\\]\\.env(\\.\\w+)?(\s|$|['"])/,
    /[/\\]\\.config[/\\]a-llmcli[/\\]/,
    /[/\\]\\.aws[/\\]/,
    /\\.pem(\s|$|['"])/,
    /\\.key(\s|$|['"])/,
    /\/\.gitconfig(\s|$|['"])/,
    /\/\.netrc(\s|$|['"])/,
    /config\.yaml(\s|$|['"])/,
  ];

  for (const pattern of sensitiveIndicators) {
    if (pattern.test(command)) {
      return true;
    }
  }
  return false;
}

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

  // --- Sensitive path check (runs BEFORE safe-command auto-approval) ---
  // If the command reads or writes sensitive files, it ALWAYS needs confirmation.
  if (bashRefsSensitivePath(command)) {
    return true;
  }

  // Write redirection (>, >>) always needs confirmation — changes files
  if (/>>?\s/.test(command)) {
    return true;
  }

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
  // --- Sensitive path check ---
  if (isSensitivePath(path)) {
    return true;
  }

  // Outside workspace — needs confirmation
  if (path.startsWith('/') && !path.startsWith(workspaceRoot)) {
    return true;
  }

  return false; // Inside workspace, non-sensitive — auto-run with diff display
}

function needsReadFileConfirm(path: string, workspaceRoot: string): boolean {
  // --- Sensitive path check ---
  if (isSensitivePath(path)) {
    return true;
  }

  // Auto-run reads inside workspace
  if (!path.startsWith('/') || path.startsWith(workspaceRoot)) {
    return false; // Auto-run
  }

  return true; // Outside workspace — needs confirmation
}
