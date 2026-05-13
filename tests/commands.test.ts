import { describe, it, expect } from 'vitest';
import { parseCommand, executeCommand } from '../src/commands/index.js';
import type { AppState, AppAction } from '../src/types.js';
import type { ConfigType } from '../src/schemas.js';

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    session: {
      id: 'test-session',
      title: '',
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      mode: 'chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    status: 'idle',
    pendingToolCall: undefined,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<ConfigType> = {}): ConfigType {
  return {
    default_provider: 'anthropic',
    default_mode: 'chat',
    environment: { type: 'termux', include_builtin_context: true },
    session_policy: {
      profile: 'safe-chat',
      workspace_root: '/root',
      dry_run_first: false,
      bash_confirmation: 'always',
      file_confirmation: 'always',
      network_confirmation: 'always',
      peripheral_confirmation: 'always',
    },
    providers: {
      anthropic: { type: 'anthropic', api_key: 'sk-test', model: 'claude-sonnet-4' },
    },
    ...overrides,
  };
}

describe('parseCommand', () => {
  it('returns null for input without slash', () => {
    expect(parseCommand('hello')).toBeNull();
  });

  it('parses simple command', () => {
    expect(parseCommand('/help')).toEqual({ name: 'help', args: [] });
  });

  it('parses command with args', () => {
    expect(parseCommand('/model claude-sonnet-4')).toEqual({
      name: 'model',
      args: ['claude-sonnet-4'],
    });
  });

  it('trims whitespace', () => {
    expect(parseCommand('/clear')).toEqual({ name: 'clear', args: [] });
  });

  it('returns null for bare slash', () => {
    expect(parseCommand('/')).toBeNull();
  });
});

describe('executeCommand', () => {
  it('/help returns formatted list', async () => {
    const result = await executeCommand('/help', {
      state: makeState(),
      dispatch: (a) => a as unknown as AppState,
      config: makeConfig(),
    });
    expect(result).toContain('/clear');
    expect(result).toContain('/help');
    expect(result).toContain('/model');
    expect(result).toContain('/mode');
  });

  it('/clear dispatches RESET_MESSAGES', async () => {
    let dispatched: AppAction | null = null;
    const result = await executeCommand('/clear', {
      state: makeState(),
      dispatch: (a) => {
        dispatched = a;
        return a as unknown as AppState;
      },
      config: makeConfig(),
    });
    expect(dispatched).toEqual({ type: 'RESET_MESSAGES' });
    expect(result).toBeNull();
  });

  it('/mode toggles mode', async () => {
    const result = await executeCommand('/mode', {
      state: makeState({ session: { ...makeState().session, mode: 'agent' } }),
      dispatch: (a) => a as unknown as AppState,
      config: makeConfig(),
    });
    expect(result).toContain('chat'); // toggles from agent to chat
  });

  it('/model shows current model', async () => {
    const result = await executeCommand('/model', {
      state: makeState(),
      dispatch: (a) => a as unknown as AppState,
      config: makeConfig(),
    });
    expect(result).toContain('claude-sonnet-4');
  });

  it('unknown command returns error message', async () => {
    const result = await executeCommand('/nonexistent', {
      state: makeState(),
      dispatch: (a) => a as unknown as AppState,
      config: makeConfig(),
    });
    expect(result).toContain('Unknown command');
  });
});
