import { copyFileSync, chmodSync, existsSync } from 'fs';
import { join } from 'path';
import { getConfigDir, getConfigPath, ensureDir } from '../paths.js';

const CONFIG_TEMPLATE = join(
  new URL('.', import.meta.url).pathname,
  '..', '..', '..', 'config.example.yaml'
);

/**
 * Ensure config file exists.
 * If missing — copies config.example.yaml and sets mode 0o600.
 * Returns true if file was created, false if already exists.
 */
export function ensureConfigExists(): boolean {
  const configPath = getConfigPath();

  if (existsSync(configPath)) {
    return false;
  }

  ensureDir(getConfigDir());
  copyFileSync(CONFIG_TEMPLATE, configPath);
  chmodSync(configPath, 0o600);

  return true;
}
