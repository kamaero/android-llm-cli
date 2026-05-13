import type { SecurityConfig } from '../types.js';

const MODE_DESCRIPTIONS: Record<string, string> = {
  normal: 'Smart auto-approval for safe operations (pwd, ls, git status, npm test, etc.). Confirmation required for risky operations (rm, install, curl, etc.).',
  hardcore: 'Full auto-execution mode. All tools run automatically without confirmation.',
};

/**
 * Format security config as human-readable text for the LLM prompt.
 */
export function formatSecurityConfig(security: SecurityConfig): string {
  const modeDesc = MODE_DESCRIPTIONS[security.mode] ?? 'Unknown mode';

  return [
    `Security mode: ${security.mode}`,
    `  ${modeDesc}`,
    `  Workspace root: ${security.workspaceRoot}`,
    '',
    security.mode === 'normal'
      ? 'In normal mode, these commands auto-run: pwd, ls, find, grep, cat, git status/diff/log, npm test/run, node, python, mkdir, touch, cd, echo (when paths are inside workspace)'
      : 'In hardcore mode, all tools execute automatically without any confirmation.',
  ].join('\n');
}
