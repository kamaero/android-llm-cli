import { describe, it, expect } from 'vitest';
import { buildPromptContext } from '../src/prompts/buildPromptContext.js';
import { getEnvironmentPrompt } from '../src/prompts/environment.js';
import { formatSessionPolicy } from '../src/prompts/sessionPolicy.js';
import type { RuntimeEnvironment, SessionPolicy } from '../src/types.js';

const termuxEnv: RuntimeEnvironment = {
  type: 'termux',
  includeBuiltinContext: true,
};

const noContextEnv: RuntimeEnvironment = {
  type: 'termux',
  includeBuiltinContext: false,
};

const defaultPolicy: SessionPolicy = {
  profile: 'code-workspace',
  workspaceRoot: '$HOME/projects',
  dryRunFirst: false,
  bashConfirmation: 'always',
  fileConfirmation: 'always',
  networkConfirmation: 'always',
  peripheralConfirmation: 'always',
};

describe('getEnvironmentPrompt', () => {
  it('includes Termux keywords for termux environment', () => {
    const prompt = getEnvironmentPrompt(termuxEnv);
    expect(prompt).toContain('Termux');
    expect(prompt).toContain('Android');
    expect(prompt).toContain('pkg/apt');
    expect(prompt).toContain('$PREFIX/tmp');
    expect(prompt).toContain('termux-setup-storage');
  });

  it('returns generic prompt for linux type', () => {
    const prompt = getEnvironmentPrompt({ type: 'linux', includeBuiltinContext: true });
    expect(prompt).toContain('Linux');
  });

  it('returns generic prompt for unknown type', () => {
    const prompt = getEnvironmentPrompt({ type: 'unknown', includeBuiltinContext: true });
    expect(prompt).toContain('CLI environment');
  });
});

describe('formatSessionPolicy', () => {
  it('includes profile type', () => {
    const text = formatSessionPolicy(defaultPolicy);
    expect(text).toContain('code-workspace');
    expect(text).toContain('$HOME/projects');
  });

  it('includes confirmation labels', () => {
    const text = formatSessionPolicy(defaultPolicy);
    expect(text).toContain('Always confirm');
  });

  it('reflects dry_run_first', () => {
    const policy = { ...defaultPolicy, dryRunFirst: true };
    const text = formatSessionPolicy(policy);
    expect(text).toContain('yes');
  });
});

describe('buildPromptContext', () => {
  it('includes base assistant instruction', () => {
    const prompt = buildPromptContext({
      environment: termuxEnv,
      sessionPolicy: defaultPolicy,
    });
    expect(prompt).toContain('helpful CLI assistant');
  });

  it('includes Termux environment prompt by default', () => {
    const prompt = buildPromptContext({
      environment: termuxEnv,
      sessionPolicy: defaultPolicy,
    });
    expect(prompt).toContain('Termux on Android');
    expect(prompt).toContain('pkg/apt');
    expect(prompt).toContain('$PREFIX/tmp');
  });

  it('excludes environment prompt when include_builtin_context is false', () => {
    const prompt = buildPromptContext({
      environment: noContextEnv,
      sessionPolicy: defaultPolicy,
    });
    expect(prompt).not.toContain('Termux on Android');
  });

  it('includes user extra context when provided', () => {
    const prompt = buildPromptContext({
      environment: termuxEnv,
      sessionPolicy: defaultPolicy,
      extraContext: 'User prefers concise explanations in Russian.',
    });
    expect(prompt).toContain('Russian');
  });

  it('does not include extra context when not provided', () => {
    const prompt = buildPromptContext({
      environment: termuxEnv,
      sessionPolicy: defaultPolicy,
    });
    expect(prompt).not.toContain('User Context');
  });
});
