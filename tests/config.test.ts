import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadConfig } from '../src/storage/config.js';

const VALID_YAML = `
default_provider: anthropic
default_mode: chat
environment:
  type: termux
  include_builtin_context: true
session_policy:
  profile: code-workspace
  workspace_root: "$HOME/projects"
  dry_run_first: false
  bash_confirmation: always
  file_confirmation: always
  network_confirmation: always
  peripheral_confirmation: always
providers:
  anthropic:
    type: anthropic
    api_key: sk-ant-fake
    model: claude-sonnet-4-6
`;

const YAML_WITH_ENV_INTERP = `
default_provider: openai
default_mode: chat
environment:
  type: termux
  include_builtin_context: true
session_policy:
  profile: code-workspace
  workspace_root: "$HOME/projects"
  dry_run_first: false
  bash_confirmation: always
  file_confirmation: always
  network_confirmation: always
  peripheral_confirmation: always
providers:
  openai:
    type: openai
    api_key: \${TEST_OPENAI_KEY}
    model: gpt-4o
`;

const YAML_MISSING_REQUIRED_KEY = `
default_provider: anthropic
default_mode: chat
environment:
  type: termux
`;

const BAD_YAML = `
default_provider: 123
default_mode: chat
environment:
  type: unknown-runtime
  include_builtin_context: true
session_policy:
  profile: invalid-profile
`;

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'a-llmcli-test-'));
});

function writeTestConfig(name: string, content: string): string {
  const dir = join(tmpDir, name);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'config.yaml');
  writeFileSync(path, content, 'utf-8');
  return path;
}

describe('loadConfig', () => {
  it('loads and validates a valid config', () => {
    const path = writeTestConfig('valid', VALID_YAML);
    const config = loadConfig(path);
    expect(config.default_provider).toBe('anthropic');
    expect(config.default_mode).toBe('chat');
    expect(config.environment.type).toBe('termux');
    expect(config.session_policy.profile).toBe('code-workspace');
    expect(config.providers.anthropic.model).toBe('claude-sonnet-4-6');
  });

  it('interpolates ${ENV_VAR} placeholders', () => {
    process.env.TEST_OPENAI_KEY = 'sk-env-interpolated';
    const path = writeTestConfig('env-interp', YAML_WITH_ENV_INTERP);
    const config = loadConfig(path);
    expect(config.providers.openai.api_key).toBe('sk-env-interpolated');
    delete process.env.TEST_OPENAI_KEY;
  });

  it('preserves ${ENV_VAR} when env var is not set', () => {
    delete process.env.TEST_OPENAI_KEY;
    const path = writeTestConfig('env-missing', YAML_WITH_ENV_INTERP);
    const config = loadConfig(path);
    expect(config.providers.openai.api_key).toBe('${TEST_OPENAI_KEY}');
  });

  it('throws on missing session_policy (required fields)', () => {
    const path = writeTestConfig('missing-key', YAML_MISSING_REQUIRED_KEY);
    expect(() => loadConfig(path)).toThrow();
  });

  it('throws on bad YAML (invalid types)', () => {
    const path = writeTestConfig('bad-yaml', BAD_YAML);
    expect(() => loadConfig(path)).toThrow();
  });

  it('throws on non-existent file', () => {
    expect(() => loadConfig('/nonexistent/config.yaml')).toThrow(/Config file not found/);
  });
});
