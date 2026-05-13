import type { RuntimeEnvironment, SecurityConfig, ITool } from '../types.js';
import { getEnvironmentPrompt, shouldIncludeEnvironmentPrompt } from './environment.js';
import { formatSecurityConfig } from './sessionPolicy.js';

/**
 * Build the full system/developer prompt for a provider.
 *
 * Layered structure:
 * 1. Base assistant instruction (role, tone, safety) — adapts to security mode
 * 2. Environment prompt (Termux/Android constraints)
 * 3. Security config (workspace, auto-approval rules)
 * 4. User extra context
 *
 * @returns Complete system prompt string
 */
export function buildPromptContext(params: {
  environment: RuntimeEnvironment;
  security: SecurityConfig;
  tools?: ITool[];
  extraContext?: string;
}): string {
  const isHardcore = params.security.mode === 'hardcore';

  const BASE_ASSISTANT_INSTRUCTION = isHardcore
    ? `You are a HARDCORE terminal agent running on Android/Termux.
You have tools available: bash, read_file, write_file.
CRITICAL: Always USE bash tool to execute commands. NEVER write commands as plain text.
No pleasantries, no explanations. Execute bash tool immediately and return output.
Chain multiple commands — call bash tool several times in one response if needed.
Be brief. Be fast. No hand-holding.`
    : `You are a helpful CLI assistant running on Android/Termux.
Your goal is to help the user with their tasks through the terminal.
Always explain what you are about to do before using any tools.
Do not execute destructive operations without explicit user confirmation.`;

  const parts: string[] = [BASE_ASSISTANT_INSTRUCTION];

  // Environment prompt
  if (shouldIncludeEnvironmentPrompt(params.environment)) {
    parts.push('\n## Environment\n');
    parts.push(getEnvironmentPrompt(params.environment));
  }

  // Security config
  parts.push('\n## Security Configuration\n');
  parts.push(formatSecurityConfig(params.security));

  // Tool descriptions
  if (params.tools && params.tools.length > 0) {
    parts.push('\n## Available Tools\n');
    for (const tool of params.tools) {
      parts.push(`- ${tool.name}: ${tool.description}`);
    }
  }

  // User extra context
  if (params.extraContext) {
    parts.push('\n## User Context\n');
    parts.push(params.extraContext);
  }

  return parts.join('\n');
}
