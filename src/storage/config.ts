import { readFileSync, existsSync } from 'fs';
import { load } from 'js-yaml';
import { ConfigSchema, type ConfigType } from '../schemas.js';
import { getConfigPath } from '../paths.js';

/**
 * Interpolate ${ENV_VAR} placeholders in a string value.
 * Preserves literals that don't match any env var.
 */
export function interpolateEnv(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, name: string) => {
    return process.env[name] ?? `\${${name}}`;
  });
}

/**
 * Recursively walk a parsed YAML object and interpolate env vars
 * in all string values.
 */
function interpolateDeep(value: unknown): unknown {
  if (typeof value === 'string') {
    return interpolateEnv(value);
  }
  if (Array.isArray(value)) {
    return value.map(interpolateDeep);
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = interpolateDeep(v);
    }
    return result;
  }
  return value;
}

/**
 * Load and validate config from YAML file.
 * @param explicitPath - optional explicit path to config.yaml
 * @returns validated and env-interpolated config
 */
export function loadConfig(explicitPath?: string): ConfigType {
  const configPath = getConfigPath(explicitPath);

  if (!existsSync(configPath)) {
    throw new Error(
      `Config file not found at ${configPath}. ` +
      `Run \`a-llmcli\` once to auto-create it, or copy config.example.yaml.`
    );
  }

  const raw = readFileSync(configPath, 'utf-8');
  const parsed = load(raw) as Record<string, unknown>;
  const interpolated = interpolateDeep(parsed);

  return ConfigSchema.parse(interpolated);
}
