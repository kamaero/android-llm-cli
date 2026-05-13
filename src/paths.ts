import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const APP_NAME = 'a-llmcli';

/**
 * Resolve XDG-style config directory.
 * Order: $XDG_CONFIG_HOME -> ~/.config
 */
export function getConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg || join(homedir(), '.config');
  return join(base, APP_NAME);
}

/**
 * Resolve XDG-style data directory.
 * Order: $XDG_DATA_HOME -> ~/.local/share
 */
export function getDataDir(): string {
  const xdg = process.env.XDG_DATA_HOME;
  const base = xdg || join(homedir(), '.local', 'share');
  return join(base, APP_NAME);
}

/**
 * Resolve XDG-style state directory.
 * Order: $XDG_STATE_HOME -> ~/.local/state
 */
export function getStateDir(): string {
  const xdg = process.env.XDG_STATE_HOME;
  const base = xdg || join(homedir(), '.local', 'state');
  return join(base, APP_NAME);
}

/**
 * Get path to config.yaml
 */
export function getConfigPath(explicitPath?: string): string {
  if (explicitPath) return explicitPath;
  return join(getConfigDir(), 'config.yaml');
}

/**
 * Ensure directory exists (mkdir -p).
 */
export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
