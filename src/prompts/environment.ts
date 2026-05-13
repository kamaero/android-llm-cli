import type { RuntimeEnvironment } from '../types.js';

const TERMUX_PROMPT = `You are connected to a CLI running inside Termux on Android.

Important constraints:
- This is Android/Termux, not desktop Linux.
- Use pkg/apt for Termux packages.
- Do not assume systemd, sudo, /bin/bash, /usr/bin, xdg-open, pbcopy, or desktop tools exist.
- Prefer $HOME, $PREFIX, and $PREFIX/tmp for working files.
- Storage outside $HOME may require termux-setup-storage.
- Android may kill background processes.
- Long-running commands should be avoided unless the user explicitly approves them.
- Ask before destructive, network-impacting, or peripheral-access actions.
- Explain commands briefly before using tools.`;

/**
 * Return the built-in environment prompt for the given runtime environment.
 * For termux, returns the Termux/Android constraints prompt.
 * For other types, returns a generic prompt.
 */
export function getEnvironmentPrompt(env: RuntimeEnvironment): string {
  switch (env.type) {
    case 'termux':
      return TERMUX_PROMPT;
    case 'linux':
      return 'You are running on a Linux system. Standard POSIX tools are available.';
    case 'macos':
      return 'You are running on macOS. Standard BSD/POSIX tools are available.';
    default:
      return 'You are running in a CLI environment.';
  }
}

/**
 * Returns true if the environment prompt should be included in the system prompt.
 */
export function shouldIncludeEnvironmentPrompt(env: RuntimeEnvironment): boolean {
  return env.includeBuiltinContext;
}
