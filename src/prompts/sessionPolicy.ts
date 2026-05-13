import type { SessionPolicy } from '../types.js';

const PROFILE_DESCRIPTIONS: Record<string, string> = {
  'safe-chat': 'Tools are disabled. Only chat mode is available.',
  'code-workspace':
    'Tools work inside the workspace root. Every action requires confirmation.',
  'full-termux-agent':
    'Full Termux agent mode with broader file system access. Destructive, network, and peripheral actions still require confirmation.',
};

const CONFIRMATION_LABELS: Record<string, string> = {
  always: 'Always confirm',
  batch: 'Batch confirm (confirm once per batch)',
  never: 'Auto-approve (no confirmation)',
};

/**
 * Format session policy as human-readable text for the LLM prompt.
 */
export function formatSessionPolicy(policy: SessionPolicy): string {
  const profileDesc =
    PROFILE_DESCRIPTIONS[policy.profile] ?? 'Unknown profile';

  return [
    `Session policy: ${policy.profile}`,
    `  ${profileDesc}`,
    `  Workspace root: ${policy.workspaceRoot}`,
    `  Dry-run first: ${policy.dryRunFirst ? 'yes' : 'no'}`,
    `  Bash: ${CONFIRMATION_LABELS[policy.bashConfirmation]}`,
    `  File operations: ${CONFIRMATION_LABELS[policy.fileConfirmation]}`,
    `  Network: ${CONFIRMATION_LABELS[policy.networkConfirmation]}`,
    `  Peripherals: ${CONFIRMATION_LABELS[policy.peripheralConfirmation]}`,
  ].join('\n');
}
