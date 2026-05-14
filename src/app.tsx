import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import type {
  AppAction,
  AppState,
  IProvider,
  Message,
  RuntimeEnvironment,
  SecurityConfig,
  SecurityMode,
  Session,
  StreamChunk,
  ToolCall,
  ToolResult,
} from './types.js';
import { agentLoop, createReasoningBatcher, createTextBatcher, executeToolCall } from './agent/agentLoop.js';
import type { ConfigType } from './schemas.js';
import { createProvider } from './providers/registry.js';
import { buildPromptContext } from './prompts/buildPromptContext.js';
import { ThemeContext, THEMES } from './theme.js';
import {
  appendWalEntry,
  deleteWalFile,
  loadSession,
  recoverFromWal,
  saveSession,
  scanWalFiles,
  type WalScanEntry,
} from './storage/session.js';
import { ToolRegistry } from './tools/registry.js';
import { BashTool, ReadFileTool, WebFetchTool, WebSearchTool, WriteFileTool } from './tools/index.js';
import { Layout } from './ui/Layout.js';
import { RecoveryPrompt } from './ui/RecoveryPrompt.js';
import { executeCommand, type CommandContext } from './commands/index.js';
import { DEFAULT_RETRY_OPTS, withRetry } from './streaming/retry.js';

export type { ConfigType };

interface AppDependencies {
  createProvider: typeof createProvider;
  saveSession: typeof saveSession;
  loadSession: typeof loadSession;
  appendWalEntry: typeof appendWalEntry;
  recoverFromWal: typeof recoverFromWal;
  deleteWalFile: typeof deleteWalFile;
  scanWalFiles: typeof scanWalFiles;
}

const DEFAULT_DEPS: AppDependencies = {
  createProvider,
  saveSession,
  loadSession,
  appendWalEntry,
  recoverFromWal,
  deleteWalFile,
  scanWalFiles,
};

function mapEnvironment(config: ConfigType): RuntimeEnvironment {
  return {
    type: config.environment.type,
    includeBuiltinContext: config.environment.include_builtin_context,
    extraContext: config.environment.extra_context,
  };
}

function mapSecurityConfig(config: ConfigType): SecurityConfig {
  return {
    mode: config.security.mode,
    workspaceRoot: config.security.workspace_root,
  };
}

function makeSession(config: ConfigType, existingMessages: Message[] = []): Session {
  const provider = config.default_provider;
  const providerCfg = config.providers[provider];
  const now = Date.now();
  const titleSource = existingMessages.find((message) => message.role === 'user')?.content ?? '';

  return {
    id: nanoid(),
    title: titleSource.slice(0, 60),
    provider,
    model: providerCfg?.model ?? 'unknown',
    mode: config.default_mode,
    messages: existingMessages,
    createdAt: now,
    updatedAt: now,
  };
}

function makeAssistantMessage(): Message {
  return {
    id: nanoid(),
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
  };
}

function makeToolMessage(toolResult: ToolResult): Message {
  return {
    id: nanoid(),
    role: 'tool',
    content: toolResult.output,
    tool_result: toolResult,
    timestamp: Date.now(),
  };
}

function rebuildAssistantContent(chunks: StreamChunk[]): string {
  return chunks
    .filter((chunk): chunk is Extract<StreamChunk, { type: 'text' }> => chunk.type === 'text')
    .map((chunk) => chunk.delta)
    .join('');
}

function makeRecoveredSession(config: ConfigType, id: string, assistantContent: string): Session {
  const provider = config.default_provider;
  const providerCfg = config.providers[provider];
  const now = Date.now();

  return {
    id,
    title: `Recovered ${id.slice(0, 8)}`,
    provider,
    model: providerCfg?.model ?? 'unknown',
    mode: config.default_mode,
    messages: assistantContent
      ? [
          {
            id: nanoid(),
            role: 'assistant',
            content: assistantContent,
            timestamp: now,
          },
        ]
      : [],
    createdAt: now,
    updatedAt: now,
  };
}

function withUpdatedTimestamp(session: Session): Session {
  return { ...session, updatedAt: Date.now() };
}

function appendAssistantToolCall(messages: Message[], toolCall: ToolCall): Message[] {
  const nextMessages = [...messages];
  const lastMessage = nextMessages.at(-1);

  if (lastMessage?.role === 'assistant') {
    nextMessages[nextMessages.length - 1] = {
      ...lastMessage,
      tool_calls: [...(lastMessage.tool_calls ?? []), toolCall],
      timestamp: Date.now(),
    };
    return nextMessages;
  }

  nextMessages.push({
    ...makeAssistantMessage(),
    tool_calls: [toolCall],
  });
  return nextMessages;
}

function resetStreamingAssistantMessage(messages: Message[]): Message[] {
  const nextMessages = [...messages];
  const lastMessage = nextMessages.at(-1);

  if (lastMessage?.role !== 'assistant') {
    return nextMessages;
  }

  nextMessages[nextMessages.length - 1] = {
    ...lastMessage,
    content: '',
    reasoningContent: undefined,
    tool_calls: undefined,
    tokens: undefined,
    timestamp: Date.now(),
  };

  return nextMessages;
}

export function appReducer(state: AppState, action: AppAction, config: ConfigType): AppState {
  switch (action.type) {
    case 'ADD_USER_MESSAGE': {
      const session =
        state.session.messages.length === 0
          ? makeSession(config, [action.message])
          : withUpdatedTimestamp({
              ...state.session,
              title: state.session.title || action.message.content.slice(0, 60),
              messages: [...state.session.messages, action.message],
            });

      return {
        ...state,
        session,
        error: undefined,
        retryState: undefined,
      };
    }

    case 'START_STREAMING':
      return {
        ...state,
        status: 'streaming',
        error: undefined,
        retryState: undefined,
        session: withUpdatedTimestamp({
          ...state.session,
          messages: [...state.session.messages, makeAssistantMessage()],
        }),
      };

    case 'SET_RETRY':
      return {
        ...state,
        status: 'retrying',
        error: undefined,
        retryState: {
          attempt: action.attempt,
          maxAttempts: action.maxAttempts,
        },
        session: withUpdatedTimestamp({
          ...state.session,
          messages: resetStreamingAssistantMessage(state.session.messages),
        }),
      };

    case 'RESUME_STREAMING':
      return {
        ...state,
        status: 'streaming',
        error: undefined,
        retryState: undefined,
      };

    case 'APPEND_TEXT': {
      const messages = [...state.session.messages];
      const lastMessage = messages.at(-1);

      if (lastMessage?.role === 'assistant') {
        messages[messages.length - 1] = {
          ...lastMessage,
          content: lastMessage.content + action.delta,
          timestamp: Date.now(),
        };
      } else {
        messages.push({
          ...makeAssistantMessage(),
          content: action.delta,
        });
      }

      return {
        ...state,
        session: withUpdatedTimestamp({
          ...state.session,
          messages,
        }),
      };
    }

    case 'APPEND_REASONING': {
      const messages = [...state.session.messages];
      const lastMessage = messages.at(-1);

      if (lastMessage?.role === 'assistant') {
        messages[messages.length - 1] = {
          ...lastMessage,
          reasoningContent: (lastMessage.reasoningContent ?? '') + action.delta,
          timestamp: Date.now(),
        };
      } else {
        messages.push({
          ...makeAssistantMessage(),
          reasoningContent: action.delta,
        });
      }

      return {
        ...state,
        session: withUpdatedTimestamp({
          ...state.session,
          messages,
        }),
      };
    }

    case 'SET_TOOL_CALL':
      return {
        ...state,
        status: 'awaiting-tool-confirm',
        retryState: undefined,
        pendingToolCall: { call: action.toolCall },
        session: withUpdatedTimestamp({
          ...state.session,
          messages: appendAssistantToolCall(state.session.messages, action.toolCall),
        }),
      };

    case 'SET_TOOL_RESULT':
      return {
        ...state,
        retryState: undefined,
        pendingToolCall: state.pendingToolCall
          ? { ...state.pendingToolCall, result: action.toolResult }
          : undefined,
        session: withUpdatedTimestamp({
          ...state.session,
          messages: [...state.session.messages, makeToolMessage(action.toolResult)],
        }),
      };

    case 'SET_USAGE': {
      const messages = [...state.session.messages];
      const lastMessage = messages.at(-1);

      if (lastMessage?.role === 'assistant') {
        messages[messages.length - 1] = {
          ...lastMessage,
          tokens: action.inputTokens + action.outputTokens,
        };
      }

      return {
        ...state,
        session: withUpdatedTimestamp({
          ...state.session,
          messages,
        }),
      };
    }

    case 'STOP_STREAMING':
      return {
        ...state,
        status: 'idle',
        pendingToolCall: undefined,
        retryState: undefined,
      };

    case 'SET_ERROR':
      return {
        ...state,
        status: 'error',
        error: action.error,
        retryState: undefined,
      };

    case 'CONFIRM_TOOL':
      return {
        ...state,
        status: 'idle',
        retryState: undefined,
        pendingToolCall:
          state.pendingToolCall?.call.id === action.toolCallId ? undefined : state.pendingToolCall,
      };

    case 'REJECT_TOOL':
      return {
        ...state,
        status: 'idle',
        retryState: undefined,
        pendingToolCall:
          state.pendingToolCall?.call.id === action.toolCallId ? undefined : state.pendingToolCall,
      };

    case 'RESET_MESSAGES':
      return {
        ...state,
        status: 'idle',
        error: undefined,
        retryState: undefined,
        pendingToolCall: undefined,
        session: withUpdatedTimestamp({ ...state.session, messages: [] }),
      };

    case 'SET_MODEL':
      return {
        ...state,
        session: withUpdatedTimestamp({ ...state.session, model: action.model }),
      };

    case 'SET_MODE':
      return {
        ...state,
        session: withUpdatedTimestamp({ ...state.session, mode: action.mode }),
      };

    case 'SET_SECURITY_MODE':
      return {
        ...state,
        securityMode: action.mode,
      };

    case 'ADD_COMMAND_OUTPUT': {
      const msg: Message = {
        id: nanoid(),
        role: 'assistant',
        content: action.content,
        timestamp: Date.now(),
      };
      return {
        ...state,
        session: withUpdatedTimestamp({
          ...state.session,
          messages: [...state.session.messages, msg],
        }),
      };
    }

    default:
      return state;
  }
}

function reduceWithConfig(config: ConfigType, state: AppState, action: AppAction): AppState {
  return appReducer(state, action, config);
}

interface AppProps {
  config: ConfigType;
  deps?: Partial<AppDependencies>;
}

export function App({ config, deps }: AppProps) {
  const runtimeDeps = useMemo(() => ({ ...DEFAULT_DEPS, ...deps }), [deps]);

  const [state, setState] = useReducer(
    (currentState: AppState, action: AppAction) => reduceWithConfig(config, currentState, action),
    config,
    (cfg) => ({
      session: makeSession(cfg),
      status: 'idle' as const,
      pendingToolCall: undefined,
      retryState: undefined,
      securityMode: cfg.security.mode,
    }),
  );
  const stateRef = useRef(state);
  const providerRef = useRef<IProvider | null>(null);
  const pendingConfirmRef = useRef<Promise<void> | null>(null);
  const toolRegistryRef = useRef(new ToolRegistry([
    new BashTool(),
    new ReadFileTool(),
    new WriteFileTool(),
    new WebFetchTool(),
    new WebSearchTool(config.tools?.web_search?.api_key ?? ''),
  ]));
  const abortControllerRef = useRef(new AbortController());
  const iterationRef = useRef(0);
  const [recoveryMode, setRecoveryMode] = useState<WalScanEntry[]>([]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    setRecoveryMode(runtimeDeps.scanWalFiles());
  }, [runtimeDeps]);

  const dispatch = useCallback(
    (action: AppAction): AppState => {
      const nextState = reduceWithConfig(config, stateRef.current, action);
      stateRef.current = nextState;
      setState(action);
      return nextState;
    },
    [config],
  );

  const getProvider = useCallback((): IProvider => {
    if (providerRef.current) {
      return providerRef.current;
    }

    const providerName = config.default_provider;
    const providerConfig = config.providers[providerName];
    providerRef.current = runtimeDeps.createProvider(
      {
        type: providerConfig.type,
        apiKey: providerConfig.api_key,
        model: providerConfig.model,
        baseUrl: providerConfig.base_url,
      },
      providerConfig.api_key,
    );
    return providerRef.current;
  }, [config, runtimeDeps]);

  const fetchResponse = useCallback(
    async (session: Session, iteration = 0): Promise<void> => {
      const provider = getProvider();
      const baseSecurity = mapSecurityConfig(config);
      const security: SecurityConfig = {
        ...baseSecurity,
        mode: stateRef.current.securityMode,
      };
      const systemPrompt = buildPromptContext({
        environment: mapEnvironment(config),
        security,
        tools: toolRegistryRef.current.list(),
      });

      if (session.mode === 'agent') {
        abortControllerRef.current = new AbortController();
        await agentLoop({
          session,
          provider,
          toolRegistry: toolRegistryRef.current,
          systemPrompt,
          dispatch,
          security,
          saveSession: runtimeDeps.saveSession,
          appendWalEntry: runtimeDeps.appendWalEntry,
          signal: abortControllerRef.current.signal,
          iteration,
        });
        return;
      }

      // Chat mode: plain streaming, no tool execution
      const tools =
        provider.capabilities.tools ? toolRegistryRef.current.enabledFor(provider) : undefined;

      dispatch({ type: 'START_STREAMING' });

      try {
        let streamAttempt = 0;
        let shouldPause = false;
        const reasoningBatcher = createReasoningBatcher(dispatch);
        const textBatcher = createTextBatcher(dispatch);

        await withRetry(
          async () => {
            if (streamAttempt > 0) {
              reasoningBatcher.cancel();
              textBatcher.cancel();
              dispatch({ type: 'RESUME_STREAMING' });
            }
            streamAttempt += 1;

            for await (const chunk of provider.stream(session.messages, { systemPrompt, tools })) {
              runtimeDeps.appendWalEntry(session.id, chunk);

              switch (chunk.type) {
                case 'text':
                  // Flush any pending reasoning before text starts (thinking → response transition)
                  reasoningBatcher.flush();
                  textBatcher.add(chunk.delta);
                  break;
                case 'reasoning':
                  // Flush any pending text before reasoning starts (response → thinking transition)
                  textBatcher.flush();
                  reasoningBatcher.add(chunk.delta);
                  break;
                case 'tool_call':
                  // Flush all pending batches before tool call
                  reasoningBatcher.flush();
                  textBatcher.flush();
                  dispatch({
                    type: 'SET_TOOL_CALL',
                    toolCall: {
                      id: chunk.id,
                      name: chunk.name,
                      input: normalizeToolInput(chunk.input),
                    },
                  });
                  shouldPause = true;
                  break;
                case 'usage':
                  dispatch({
                    type: 'SET_USAGE',
                    inputTokens: chunk.inputTokens,
                    outputTokens: chunk.outputTokens,
                  });
                  break;
                case 'done':
                  // Flush all remaining content
                  reasoningBatcher.flush();
                  textBatcher.flush();
                  break;
              }

              if (shouldPause) {
                return;
              }
            }
          },
          DEFAULT_RETRY_OPTS,
          (attempt, error) => {
            dispatch({
              type: 'SET_RETRY',
              attempt,
              maxAttempts: DEFAULT_RETRY_OPTS.maxAttempts,
            });
          },
        );

        if (shouldPause) {
          return;
        }

        const finalState = dispatch({ type: 'STOP_STREAMING' });
        runtimeDeps.saveSession(finalState.session);
        runtimeDeps.deleteWalFile(session.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        dispatch({ type: 'SET_ERROR', error: message });
      }
    },
    [config, dispatch, getProvider, runtimeDeps],
  );

  const handleAddUserMessage = useCallback(
    async (message: Message): Promise<void> => {
      iterationRef.current = 0;
      const nextState = dispatch({ type: 'ADD_USER_MESSAGE', message });
      runtimeDeps.saveSession(nextState.session);
      await fetchResponse(nextState.session, 0);
    },
    [dispatch, fetchResponse, runtimeDeps],
  );

  const handleToolDecision = useCallback(
    async (toolCallId: string, confirm: boolean): Promise<void> => {
      const pendingToolCall = stateRef.current.pendingToolCall;
      if (!pendingToolCall || pendingToolCall.call.id !== toolCallId) {
        return;
      }

      const { call } = pendingToolCall;
      let toolResult: ToolResult;

      if (confirm && stateRef.current.session.mode === 'agent') {
        toolResult = await executeToolCall(
          call,
          toolRegistryRef.current,
          mapSecurityConfig(config),
          abortControllerRef.current.signal,
        );
      } else {
        toolResult = {
          tool_call_id: toolCallId,
          output: confirm
            ? `Tool "${call.name}" approved by user.`
            : `Tool "${call.name}" rejected by user.`,
          is_error: !confirm,
        };
      }

      const stateWithResult = dispatch({ type: 'SET_TOOL_RESULT', toolResult });
      dispatch({ type: confirm ? 'CONFIRM_TOOL' : 'REJECT_TOOL', toolCallId });

      // Feed the result back into the agent loop (continue regardless of confirm/reject).
      if (stateRef.current.session.mode === 'agent') {
        iterationRef.current++;
        await fetchResponse(stateWithResult.session, iterationRef.current);
        return;
      }

      const finalState = dispatch({ type: 'STOP_STREAMING' });
      runtimeDeps.saveSession(finalState.session);
    },
    [config, dispatch, fetchResponse, runtimeDeps],
  );

  const boundDispatch = useCallback(
    (action: AppAction) => {
      switch (action.type) {
        case 'ADD_USER_MESSAGE':
          void handleAddUserMessage(action.message);
          return;
        case 'CONFIRM_TOOL':
          pendingConfirmRef.current = handleToolDecision(action.toolCallId, true);
          return;
        case 'REJECT_TOOL':
          pendingConfirmRef.current = handleToolDecision(action.toolCallId, false);
          return;
        default:
          dispatch(action);
      }
    },
    [dispatch, handleAddUserMessage, handleToolDecision],
  );

  const handleCommand = useCallback(
    async (input: string): Promise<void> => {
      const ctx: CommandContext = {
        state: stateRef.current,
        dispatch,
        config,
      };
      const output = await executeCommand(input, ctx);
      if (output !== null) {
        dispatch({ type: 'ADD_COMMAND_OUTPUT', content: output });
      }
    },
    [config, dispatch],
  );

  const handleRecoverAll = useCallback(async (): Promise<void> => {
    for (const orphan of recoveryMode) {
      const chunks = runtimeDeps.recoverFromWal(orphan.id);
      const assistantContent = rebuildAssistantContent(chunks);

      let session: Session;
      try {
        session = runtimeDeps.loadSession(orphan.id);
      } catch {
        session = makeRecoveredSession(config, orphan.id, assistantContent);
      }

      if (assistantContent) {
        session = withUpdatedTimestamp({
          ...session,
          messages: [
            ...session.messages,
            {
              id: nanoid(),
              role: 'assistant',
              content: assistantContent,
              timestamp: Date.now(),
            },
          ],
        });
      }

      runtimeDeps.saveSession(session);
      runtimeDeps.deleteWalFile(orphan.id);
    }
  }, [config, recoveryMode, runtimeDeps]);

  const handleDiscardAll = useCallback(async (): Promise<void> => {
    for (const orphan of recoveryMode) {
      runtimeDeps.deleteWalFile(orphan.id);
    }
  }, [recoveryMode, runtimeDeps]);

  if (recoveryMode.length > 0) {
    return (
      <RecoveryPrompt
        orphans={recoveryMode}
        onRecoverAll={handleRecoverAll}
        onDiscardAll={handleDiscardAll}
        onDone={() => setRecoveryMode([])}
      />
    );
  }

  const theme = THEMES[config.theme ?? 'default'] ?? THEMES.default;
  return (
    <ThemeContext.Provider value={theme}>
      <Layout state={state} dispatch={boundDispatch} onCommand={handleCommand} />
    </ThemeContext.Provider>
  );
}

function normalizeToolInput(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }

  return { value: input };
}
