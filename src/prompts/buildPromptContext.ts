import type { RuntimeEnvironment, SessionPolicy, ITool } from '../types.js';
import { getEnvironmentPrompt, shouldIncludeEnvironmentPrompt } from './environment.js';
import { formatSessionPolicy } from './sessionPolicy.js';

const BASE_ASSISTANT_INSTRUCTION = `You are a helpful CLI assistant running on Android/Termux.
Your goal is to help the user with their tasks through the terminal.
Always explain what you are about to do before using any tools.
Do not execute destructive operations without explicit user confirmation.`;

/**
 * Build the full system/developer prompt for a provider.
 *
 * Layered structure:
 * 1. Base assistant instruction (role, tone, safety)
 * 2. Environment prompt (Termux/Android constraints)
 * 3. Session policy (workspace, confirmation modes)
 * 4. User extra context
 *
 * @returns Complete system prompt string
 */
export function buildPromptContext(params: {
  environment: RuntimeEnvironment;
  sessionPolicy: SessionPolicy;
  tools?: ITool[];
  extraContext?: string;
}): string {
  const parts: string[] = [BASE_ASSISTANT_INSTRUCTION];

  // Environment prompt
  if (shouldIncludeEnvironmentPrompt(params.environment)) {
    parts.push('\n## Environment\n');
    parts.push(getEnvironmentPrompt(params.environment));
  }

  // Session policy
  parts.push('\n## Session Policy\n');
  parts.push(formatSessionPolicy(params.sessionPolicy));

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
