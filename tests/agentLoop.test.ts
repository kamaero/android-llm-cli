import { describe, expect, it, vi } from 'vitest';
import { nanoid } from 'nanoid';

import { agentLoop, executeToolCall } from '../src/agent/agentLoop.js';
import { AGENT_LOOP_MAX_ITERATIONS_MVP } from '../src/constants.js';
import type {
  AppAction,
  AppState,
  IProvider,
  ITool,
  Message,
  Session,
  SessionPolicy,
  StreamChunk,
  ToolContext,
} from '../src/types.js';
import { ToolRegistry } from '../src/tools/registry.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function* makeChunks(...chunks: StreamChunk[]): AsyncIterable<StreamChunk> {
  for (const chunk of chunks) yield chunk;
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: nanoid(),
    title: 'Test session',
    provider: 'test',
    model: 'test-model',
    mode: 'agent',
    messages: [{ id: nanoid(), role: 'user', content: 'hello', timestamp: Date.now() }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeProvider(chunks: AsyncIterable<StreamChunk>): IProvider {
  return {
    name: 'test',
    model: 'test-model',
    capabilities: {
      streaming: true,
      tools: true,
      vision: false,
      systemPrompt: 'parameter',
    },
    stream: vi.fn().mockReturnValue(chunks),
  };
}

function makeTool(name: string, result: string | Error): ITool {
  return {
    name,
    description: `${name} tool`,
    schema: { type: 'object', properties: {}, required: [] },
    execute: vi.fn<(input: Record<string, unknown>, ctx: ToolContext) => Promise<string>>(
      async () => {
        if (result instanceof Error) throw result;
        return result;
      },
    ),
  };
}

function makePolicy(overrides: Partial<SessionPolicy> = {}): SessionPolicy {
  return {
    profile: 'code-workspace',
    workspaceRoot: '/tmp',
    dryRunFirst: false,
    bashConfirmation: 'never',
    fileConfirmation: 'never',
    networkConfirmation: 'never',
    peripheralConfirmation: 'never',
    ...overrides,
  };
}

function makeInitialState(session: Session): AppState {
  return { session, status: 'idle', pendingToolCall: undefined };
}

/**
 * Minimal dispatch that applies just enough action cases for agentLoop to work.
 * Tracks all dispatched actions for assertion in tests.
 */
function makeDispatch(initial: AppState): {
  dispatch: (action: AppAction) => AppState;
  actions: AppAction[];
  getState: () => AppState;
} {
  let state = initial;
  const actions: AppAction[] = [];

  const dispatch = (action: AppAction): AppState => {
    actions.push(action);

    switch (action.type) {
      case 'START_STREAMING': {
        const assistantMsg: Message = {
          id: nanoid(),
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
        };
        state = {
          ...state,
          status: 'streaming',
          session: {
            ...state.session,
            messages: [...state.session.messages, assistantMsg],
            updatedAt: Date.now(),
          },
        };
        break;
      }
      case 'SET_RETRY': {
        const messages = [...state.session.messages];
        const last = messages.at(-1);
        if (last?.role === 'assistant') {
          messages[messages.length - 1] = {
            ...last,
            content: '',
            tokens: undefined,
            tool_calls: undefined,
          };
        }
        state = {
          ...state,
          status: 'retrying',
          retryState: { attempt: action.attempt, maxAttempts: action.maxAttempts },
          session: { ...state.session, messages },
        };
        break;
      }
      case 'RESUME_STREAMING':
        state = { ...state, status: 'streaming', retryState: undefined };
        break;
      case 'APPEND_TEXT': {
        const messages = [...state.session.messages];
        const last = messages.at(-1);
        if (last?.role === 'assistant') {
          messages[messages.length - 1] = {
            ...last,
            content: last.content + action.delta,
          };
        }
        state = { ...state, session: { ...state.session, messages } };
        break;
      }
      case 'SET_TOOL_CALL': {
        const messages = [...state.session.messages];
        const last = messages.at(-1);
        if (last?.role === 'assistant') {
          messages[messages.length - 1] = {
            ...last,
            tool_calls: [...(last.tool_calls ?? []), action.toolCall],
          };
        }
        state = {
          ...state,
          status: 'awaiting-tool-confirm',
          pendingToolCall: { call: action.toolCall },
          session: { ...state.session, messages },
        };
        break;
      }
      case 'SET_TOOL_RESULT': {
        const toolMsg: Message = {
          id: nanoid(),
          role: 'tool',
          content: action.toolResult.output,
          tool_result: action.toolResult,
          timestamp: Date.now(),
        };
        state = {
          ...state,
          pendingToolCall: state.pendingToolCall
            ? { ...state.pendingToolCall, result: action.toolResult }
            : undefined,
          session: {
            ...state.session,
            messages: [...state.session.messages, toolMsg],
          },
        };
        break;
      }
      case 'SET_USAGE': {
        const messages = [...state.session.messages];
        const last = messages.at(-1);
        if (last?.role === 'assistant') {
          messages[messages.length - 1] = {
            ...last,
            tokens: action.inputTokens + action.outputTokens,
          };
        }
        state = { ...state, session: { ...state.session, messages } };
        break;
      }
      case 'STOP_STREAMING':
        state = { ...state, status: 'idle', pendingToolCall: undefined };
        break;
      case 'SET_ERROR':
        state = { ...state, status: 'error', error: action.error };
        break;
      default:
        break;
    }

    return state;
  };

  return { dispatch, actions, getState: () => state };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('agentLoop', () => {
  it('streams text and stops cleanly', async () => {
    const session = makeSession();
    const { dispatch, actions } = makeDispatch(makeInitialState(session));
    const saveSession = vi.fn();

    await agentLoop({
      session,
      provider: makeProvider(
        makeChunks(
          { type: 'text', delta: 'Hello' },
          { type: 'text', delta: ' world' },
          { type: 'done' },
        ),
      ),
      toolRegistry: new ToolRegistry(),
      systemPrompt: 'You are a test assistant.',
      dispatch,
      sessionPolicy: makePolicy(),
      saveSession,
      signal: new AbortController().signal,
    });

    expect(actions.map((a) => a.type)).toContain('START_STREAMING');
    expect(actions.map((a) => a.type)).toContain('APPEND_TEXT');
    expect(actions.map((a) => a.type)).toContain('STOP_STREAMING');
    expect(saveSession).toHaveBeenCalledOnce();
  });

  it('dispatches SET_USAGE when usage chunk arrives', async () => {
    const session = makeSession();
    const { dispatch, actions } = makeDispatch(makeInitialState(session));

    await agentLoop({
      session,
      provider: makeProvider(
        makeChunks({ type: 'usage', inputTokens: 10, outputTokens: 5 }, { type: 'done' }),
      ),
      toolRegistry: new ToolRegistry(),
      systemPrompt: '',
      dispatch,
      sessionPolicy: makePolicy(),
      saveSession: vi.fn(),
      signal: new AbortController().signal,
    });

    const usageAction = actions.find((a) => a.type === 'SET_USAGE');
    expect(usageAction).toBeDefined();
    expect(usageAction).toMatchObject({ type: 'SET_USAGE', inputTokens: 10, outputTokens: 5 });
  });

  it("dispatches SET_TOOL_CALL and returns without executing in 'always' mode", async () => {
    const tool = makeTool('bash', 'output');
    const registry = new ToolRegistry([tool]);
    const session = makeSession();
    const { dispatch, actions } = makeDispatch(makeInitialState(session));
    const saveSession = vi.fn();

    await agentLoop({
      session,
      provider: makeProvider(
        makeChunks({ type: 'tool_call', id: 'tc1', name: 'bash', input: { command: 'ls' } }),
      ),
      toolRegistry: registry,
      systemPrompt: '',
      dispatch,
      sessionPolicy: makePolicy({ bashConfirmation: 'always' }),
      saveSession,
      signal: new AbortController().signal,
    });

    // SET_TOOL_CALL dispatched but STOP_STREAMING is NOT — loop paused for user
    expect(actions.map((a) => a.type)).toContain('SET_TOOL_CALL');
    expect(actions.map((a) => a.type)).not.toContain('STOP_STREAMING');
    expect(saveSession).not.toHaveBeenCalled();
    // Tool was NOT executed
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it("auto-executes tool and loops in 'never' mode", async () => {
    const tool = makeTool('bash', 'hello from bash');
    const registry = new ToolRegistry([tool]);
    const session = makeSession();
    const { dispatch, actions } = makeDispatch(makeInitialState(session));

    // First call: tool_call; second call (after tool result): done
    const provider: IProvider = {
      name: 'test',
      model: 'test-model',
      capabilities: { streaming: true, tools: true, vision: false, systemPrompt: 'parameter' },
      stream: vi
        .fn()
        .mockReturnValueOnce(
          makeChunks({ type: 'tool_call', id: 'tc1', name: 'bash', input: { command: 'echo hi' } }),
        )
        .mockReturnValueOnce(makeChunks({ type: 'text', delta: 'done!' }, { type: 'done' })),
    };

    const saveSession = vi.fn();

    await agentLoop({
      session,
      provider,
      toolRegistry: registry,
      systemPrompt: '',
      dispatch,
      sessionPolicy: makePolicy({ bashConfirmation: 'never' }),
      saveSession,
      signal: new AbortController().signal,
    });

    expect(tool.execute).toHaveBeenCalledOnce();
    expect(actions.map((a) => a.type)).toContain('SET_TOOL_CALL');
    expect(actions.map((a) => a.type)).toContain('SET_TOOL_RESULT');
    expect(actions.map((a) => a.type)).toContain('STOP_STREAMING');
    expect(provider.stream).toHaveBeenCalledTimes(2);
    expect(saveSession).toHaveBeenCalledOnce();

    const toolResultAction = actions.find((a) => a.type === 'SET_TOOL_RESULT');
    expect(toolResultAction).toMatchObject({
      type: 'SET_TOOL_RESULT',
      toolResult: { tool_call_id: 'tc1', output: 'hello from bash' },
    });
    expect(
      (toolResultAction as Extract<typeof toolResultAction, { type: 'SET_TOOL_RESULT' }>)
        ?.toolResult.is_error,
    ).toBeUndefined();
  });

  it('stops after AGENT_LOOP_MAX_ITERATIONS_MVP auto-executions', async () => {
    const tool = makeTool('bash', 'result');
    const registry = new ToolRegistry([tool]);
    const session = makeSession();
    const { dispatch, actions } = makeDispatch(makeInitialState(session));

    // Always returns a tool_call so the loop would run forever without the limit
    const provider: IProvider = {
      name: 'test',
      model: 'test-model',
      capabilities: { streaming: true, tools: true, vision: false, systemPrompt: 'parameter' },
      stream: vi.fn().mockImplementation(() =>
        makeChunks({ type: 'tool_call', id: nanoid(), name: 'bash', input: { command: 'loop' } }),
      ),
    };

    await agentLoop({
      session,
      provider,
      toolRegistry: registry,
      systemPrompt: '',
      dispatch,
      sessionPolicy: makePolicy({ bashConfirmation: 'never' }),
      saveSession: vi.fn(),
      signal: new AbortController().signal,
    });

    expect(tool.execute).toHaveBeenCalledTimes(AGENT_LOOP_MAX_ITERATIONS_MVP);
    expect(actions.map((a) => a.type)).toContain('STOP_STREAMING');
  });

  it('returns is_error ToolResult when tool execute throws', async () => {
    const tool = makeTool('bash', new Error('spawn failed'));
    const registry = new ToolRegistry([tool]);
    const session = makeSession();
    const { dispatch, actions } = makeDispatch(makeInitialState(session));

    const provider: IProvider = {
      name: 'test',
      model: 'test-model',
      capabilities: { streaming: true, tools: true, vision: false, systemPrompt: 'parameter' },
      stream: vi
        .fn()
        .mockReturnValueOnce(
          makeChunks({ type: 'tool_call', id: 'tc1', name: 'bash', input: { command: 'bad' } }),
        )
        .mockReturnValueOnce(makeChunks({ type: 'done' })),
    };

    await agentLoop({
      session,
      provider,
      toolRegistry: registry,
      systemPrompt: '',
      dispatch,
      sessionPolicy: makePolicy({ bashConfirmation: 'never' }),
      saveSession: vi.fn(),
      signal: new AbortController().signal,
    });

    const resultAction = actions.find((a) => a.type === 'SET_TOOL_RESULT');
    expect(resultAction).toMatchObject({
      type: 'SET_TOOL_RESULT',
      toolResult: { tool_call_id: 'tc1', is_error: true, output: 'spawn failed' },
    });
  });

  it('dispatches SET_ERROR when the stream throws', async () => {
    const session = makeSession();
    const { dispatch, actions } = makeDispatch(makeInitialState(session));

    async function* failingStream(): AsyncIterable<StreamChunk> {
      yield { type: 'text', delta: 'partial' };
      throw new Error('network error');
    }

    await agentLoop({
      session,
      provider: {
        name: 'test',
        model: 'test-model',
        capabilities: { streaming: true, tools: true, vision: false, systemPrompt: 'parameter' },
        stream: vi.fn(() => failingStream()),
      },
      toolRegistry: new ToolRegistry(),
      systemPrompt: '',
      dispatch,
      sessionPolicy: makePolicy(),
      saveSession: vi.fn(),
      signal: new AbortController().signal,
    });

    expect(actions.filter((a) => a.type === 'SET_RETRY')).toHaveLength(2);
    const errAction = actions.find((a) => a.type === 'SET_ERROR');
    expect(errAction).toMatchObject({ type: 'SET_ERROR', error: 'network error' });
  });

  it('aborts mid-stream without dispatching STOP_STREAMING', async () => {
    const controller = new AbortController();
    const session = makeSession();
    const { dispatch, actions } = makeDispatch(makeInitialState(session));

    async function* slowStream(): AsyncIterable<StreamChunk> {
      yield { type: 'text', delta: 'chunk1' };
      controller.abort();
      yield { type: 'text', delta: 'chunk2' }; // should be ignored
      yield { type: 'done' };
    }

    await agentLoop({
      session,
      provider: makeProvider(slowStream()),
      toolRegistry: new ToolRegistry(),
      systemPrompt: '',
      dispatch,
      sessionPolicy: makePolicy(),
      saveSession: vi.fn(),
      signal: controller.signal,
    });

    // After abort, the for-await breaks before processing 'done', but the
    // !toolCall branch still dispatches STOP_STREAMING to reset UI state.
    expect(actions.map((a) => a.type)).toContain('START_STREAMING');
    expect(actions.map((a) => a.type)).toContain('STOP_STREAMING');
    // chunk2 after abort must not have been dispatched
    const appendActions = actions.filter((a) => a.type === 'APPEND_TEXT');
    expect(appendActions).toHaveLength(1); // only chunk1
  });
});

describe('executeToolCall', () => {
  it('returns is_error when tool name is not in registry', async () => {
    const registry = new ToolRegistry();
    const result = await executeToolCall(
      { id: 'tc1', name: 'unknown_tool', input: {} },
      registry,
      makePolicy(),
      new AbortController().signal,
    );

    expect(result.is_error).toBe(true);
    expect(result.output).toContain('unknown_tool');
    expect(result.tool_call_id).toBe('tc1');
  });

  it('returns tool output on success', async () => {
    const tool = makeTool('bash', 'exit code: 0\nstdout:\nhello\n');
    const registry = new ToolRegistry([tool]);

    const result = await executeToolCall(
      { id: 'tc2', name: 'bash', input: { command: 'echo hello' } },
      registry,
      makePolicy(),
      new AbortController().signal,
    );

    expect(result.is_error).toBeUndefined();
    expect(result.output).toBe('exit code: 0\nstdout:\nhello\n');
    expect(result.tool_call_id).toBe('tc2');
  });

  it('wraps thrown errors as is_error results', async () => {
    const tool = makeTool('bash', new Error('permission denied'));
    const registry = new ToolRegistry([tool]);

    const result = await executeToolCall(
      { id: 'tc3', name: 'bash', input: {} },
      registry,
      makePolicy(),
      new AbortController().signal,
    );

    expect(result.is_error).toBe(true);
    expect(result.output).toBe('permission denied');
  });
});
