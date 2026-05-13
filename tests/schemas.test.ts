import { describe, it, expect } from 'vitest';
import { MessageSchema, SessionSchema, ConfigSchema, ToolCallSchema, ToolResultSchema } from '../src/schemas.js';

// ── Happy paths ──

describe('ToolCallSchema', () => {
  it('validates a valid tool call', () => {
    const input = { id: 'call_1', name: 'bash', input: { command: 'ls' } };
    expect(() => ToolCallSchema.parse(input)).not.toThrow();
  });

  it('rejects missing id', () => {
    expect(() => ToolCallSchema.parse({ name: 'bash', input: {} })).toThrow();
  });

  it('rejects missing name', () => {
    expect(() => ToolCallSchema.parse({ id: 'call_1', input: {} })).toThrow();
  });
});

describe('ToolResultSchema', () => {
  it('validates a valid tool result', () => {
    const input = { tool_call_id: 'call_1', output: 'file.txt' };
    expect(() => ToolResultSchema.parse(input)).not.toThrow();
  });

  it('accepts is_error flag', () => {
    const input = { tool_call_id: 'call_1', output: 'error', is_error: true };
    const parsed = ToolResultSchema.parse(input);
    expect(parsed.is_error).toBe(true);
  });

  it('rejects missing tool_call_id', () => {
    expect(() => ToolResultSchema.parse({ output: 'data' })).toThrow();
  });
});

describe('MessageSchema', () => {
  it('validates a user message', () => {
    const msg = {
      id: 'msg_1',
      role: 'user' as const,
      content: 'Hello',
      timestamp: Date.now(),
    };
    expect(() => MessageSchema.parse(msg)).not.toThrow();
  });

  it('validates an assistant message with tool_calls', () => {
    const msg = {
      id: 'msg_2',
      role: 'assistant' as const,
      content: '',
      timestamp: Date.now(),
      tool_calls: [{ id: 'tc_1', name: 'read_file', input: { path: '/tmp/test' } }],
    };
    expect(() => MessageSchema.parse(msg)).not.toThrow();
  });

  it('validates a tool message with result', () => {
    const msg = {
      id: 'msg_3',
      role: 'tool' as const,
      content: 'command output',
      timestamp: Date.now(),
      tool_result: { tool_call_id: 'tc_1', output: 'result data' },
    };
    expect(() => MessageSchema.parse(msg)).not.toThrow();
  });

  it('rejects unknown role', () => {
    expect(() =>
      MessageSchema.parse({
        id: 'bad',
        role: 'system',
        content: '',
        timestamp: 0,
      })
    ).toThrow();
  });

  it('rejects non-string content', () => {
    expect(() =>
      MessageSchema.parse({
        id: 'bad',
        role: 'user',
        content: 42,
        timestamp: 0,
      })
    ).toThrow();
  });
});

describe('SessionSchema', () => {
  const validSession = {
    id: 'sess_1',
    title: 'Test session',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    mode: 'chat' as const,
    messages: [],
    createdAt: 1000,
    updatedAt: 1000,
  };

  it('validates an empty session', () => {
    expect(() => SessionSchema.parse(validSession)).not.toThrow();
  });

  it('validates a session with messages', () => {
    const session = {
      ...validSession,
      messages: [
        { id: 'm1', role: 'user', content: 'Hi', timestamp: 1001 },
        { id: 'm2', role: 'assistant', content: 'Hello!', timestamp: 1002 },
      ],
    };
    expect(() => SessionSchema.parse(session)).not.toThrow();
  });

  it('rejects missing provider', () => {
    const { provider, ...noProvider } = validSession;
    expect(() => SessionSchema.parse(noProvider)).toThrow();
  });

  it('rejects invalid mode', () => {
    expect(() => SessionSchema.parse({ ...validSession, mode: 'invalid' })).toThrow();
  });
});

describe('ConfigSchema', () => {
  const validConfig = {
    default_provider: 'anthropic',
    default_mode: 'chat',
    environment: {
      type: 'termux',
      include_builtin_context: true,
    },
    session_policy: {
      profile: 'code-workspace',
      workspace_root: '$HOME/projects',
      dry_run_first: false,
      bash_confirmation: 'always',
      file_confirmation: 'always',
      network_confirmation: 'always',
      peripheral_confirmation: 'always',
    },
    providers: {
      anthropic: {
        type: 'anthropic',
        api_key: '${ANTHROPIC_API_KEY}',
        model: 'claude-sonnet-4-6',
      },
      openai: {
        type: 'openai',
        api_key: '${OPENAI_API_KEY}',
        model: 'gpt-4o',
      },
    },
  };

  it('validates the example config from spec', () => {
    expect(() => ConfigSchema.parse(validConfig)).not.toThrow();
  });

  it('provides defaults for environment', () => {
    const { environment, ...rest } = validConfig;
    const parsed = ConfigSchema.parse(rest);
    expect(parsed.environment.type).toBe('termux');
    expect(parsed.environment.include_builtin_context).toBe(true);
  });

  it('rejects unknown provider type', () => {
    const bad = {
      ...validConfig,
      providers: {
        custom: { type: 'gigachat', api_key: 'key', model: 'giga' },
      },
    };
    expect(() => ConfigSchema.parse(bad)).toThrow();
  });

  it('rejects missing session_policy fields', () => {
    const { session_policy, ...rest } = validConfig;
    expect(() => ConfigSchema.parse(rest)).toThrow();
  });

  it('accepts empty providers (schema allows empty record)', () => {
    const parsed = ConfigSchema.parse({ ...validConfig, providers: {} });
    expect(parsed.providers).toEqual({});
  });

  it('validates openai provider with base_url', () => {
    const config = {
      ...validConfig,
      providers: {
        deepseek: {
          type: 'openai',
          api_key: '${DEEPSEEK_API_KEY}',
          base_url: 'https://api.deepseek.com/v1',
          model: 'deepseek-chat',
        },
      },
    };
    const parsed = ConfigSchema.parse(config);
    expect(parsed.providers.deepseek.base_url).toBe('https://api.deepseek.com/v1');
  });
});
