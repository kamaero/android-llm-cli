import type { SecurityConfig } from '../types.js';

/**
 * Format security config as agent instructions.
 * Different modes get different levels of autonomy and tone.
 */
export function formatSecurityConfig(security: SecurityConfig): string {
  if (security.mode === 'hardcore') {
    return [
      '## 🔥 HARDCORE MODE ACTIVE',
      '',
      'You are in FULL AUTO mode. Rules:',
      '- Execute any command IMMEDIATELY — no asking for permission',
      '- Do NOT announce what you are about to do. Just do it and show the result.',
      '- Do NOT write "I will..." or "Let me..." — write the command and its output.',
      '- Be CONCISE. No explanations, no hand-holding, no disclaimers.',
      '- If user asks a question — answer it directly with a command.',
      '- Multiple steps = one response. Chain commands, don\'t baby-step.',
      '- Workspace root: ' + security.workspaceRoot,
      '- No confirmation. No warnings. Full send.',
    ].join('\n');
  }

  // Normal mode
  return [
    'Security mode: normal',
    '  Smart auto-approval for safe operations (pwd, ls, git status, npm test, etc.).',
    '  Confirmation required for risky operations (rm, install, curl, etc.).',
    `  Workspace root: ${security.workspaceRoot}`,
    '',
    'In normal mode, these commands auto-run: pwd, ls, find, grep, cat, git status/diff/log, npm test/run, node, python, mkdir, touch, cd, echo (when paths are inside workspace)',
  ].join('\n');
}
