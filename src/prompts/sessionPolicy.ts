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
      '- Use bash tool to execute ALL commands. NEVER write commands as plain text.',
      '- Execute bash tool IMMEDIATELY — no asking for permission, no announcements.',
      '- Do NOT write "I will..." or "Let me..." — just call the bash tool.',
      '- Be CONCISE. No explanations, no hand-holding, no disclaimers.',
      '- If user asks a question — answer it via bash tool output.',
      '- Multiple steps = one response. Chain bash calls, don\'t baby-step.',
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
