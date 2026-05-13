import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import type {
  AppAction,
  AppState,
  IProvider,
  Message,
  RuntimeEnvironment,
  Session,
  SessionPolicy,
  StreamChunk,
  ToolCall,
  ToolResult,
} from './types.js';
import type { ConfigType } from './schemas.js';
import { createProvider } from './providers/registry.js';
import { buildPromptContext } from './prompts/buildPromptContext.js';
import { saveSession } from './storage/session.js';
import { ToolRegistry } from './tools/registry.js';
import { Layout } from './ui/Layout.js';

export type { ConfigType };

interface AppDependencies {
  createProvider: typeof createProvider;
  saveSession: typeof saveSession;
}

const DEFAULT_DEPS: AppDependencies = {
  createProvider,
  saveSession,
};

function mapEnvironment(config: ConfigType): RuntimeEnvironment {
  return {
    type: config.environment.type,
    includeBuiltinContext: config.environment.include_builtin_context,
    extraContext: config.environment.extra_context,
  };
}

function mapSessionPolicy(config: ConfigType): SessionPolicy {
  return {
    profile: config.session_policy.profile,
    workspaceRoot: config.session_policy.workspace_root,
    dryRunFirst: config.session_policy.dry_run_first,
    bashConfirmation: config.session_policy.bash_confirmation,
    fileConfirmation: config.session_policy.file_confirmation,
    networkConfirmation: config.session_policy.network_confirmation,
    peripheralConfirmation: config.session_policy.peripheral_confirmation,
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
      };
    }

    case 'START_STREAMING':
      return {
        ...state,
        status: 'streaming',
        error: undefined,
        session: withUpdatedTimestamp({
          ...state.session,
          messages: [...state.session.messages, makeAssistantMessage()],
        }),
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

    case 'SET_TOOL_CALL':
      return {
        ...state,
        status: 'awaiting-tool-confirm',
        pendingToolCall: { call: action.toolCall },
        session: withUpdatedTimestamp({
          ...state.session,
          messages: appendAssistantToolCall(state.session.messages, action.toolCall),
        }),
      };

    case 'SET_TOOL_RESULT':
      return {
        ...state,
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
      };

    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.error };

    case 'CONFIRM_TOOL':
      return {
        ...state,
        status: 'idle',
        pendingToolCall:
          state.pendingToolCall?.call.id === action.toolCallId ? undefined : state.pendingToolCall,
      };

    case 'REJECT_TOOL':
      return {
        ...state,
        status: 'idle',
        pendingToolCall:
          state.pendingToolCall?.call.id === action.toolCallId ? undefined : state.pendingToolCall,
      };

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
  const runtimeDeps = { ...DEFAULT_DEPS, ...deps };
  const [mode] = useState<'chat' | 'agent'>(config.default_mode);
  const initialState: AppState = {
    session: makeSession(config),
    status: 'idle',
    pendingToolCall: undefined,
  };

  const [state, setState] = useReducer(
    (currentState: AppState, action: AppAction) => reduceWithConfig(config, currentState, action),
    initialState,
  );
  const stateRef = useRef(state);
  const providerRef = useRef<IProvider | null>(null);
  const pendingConfirmRef = useRef<Promise<void> | null>(null);
  const toolRegistryRef = useRef(new ToolRegistry());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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
    async (session: Session): Promise<void> => {
      const provider = getProvider();
      const systemPrompt = buildPromptContext({
        environment: mapEnvironment(config),
        sessionPolicy: mapSessionPolicy(config),
      });
      const tools =
        mode === 'agent' && provider.capabilities.tools
          ? toolRegistryRef.current.enabledFor(provider)
          : undefined;

      dispatch({ type: 'START_STREAMING' });

      try {
        for await (const chunk of provider.stream(session.messages, { systemPrompt, tools })) {
          const shouldPause = handleStreamChunk(chunk, dispatch);
          if (shouldPause) {
            return;
          }
        }

        const finalState = dispatch({ type: 'STOP_STREAMING' });
        runtimeDeps.saveSession(finalState.session);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        dispatch({ type: 'SET_ERROR', error: message });
      }
    },
    [config, dispatch, getProvider, mode, runtimeDeps],
  );

  const handleAddUserMessage = useCallback(
    async (message: Message): Promise<void> => {
      const nextState = dispatch({ type: 'ADD_USER_MESSAGE', message });
      await fetchResponse(nextState.session);
    },
    [dispatch, fetchResponse],
  );

  const handleToolDecision = useCallback(
    async (toolCallId: string, confirm: boolean): Promise<void> => {
      const pendingToolCall = stateRef.current.pendingToolCall;
      if (!pendingToolCall || pendingToolCall.call.id !== toolCallId) {
        return;
      }

      const toolResult: ToolResult = {
        tool_call_id: toolCallId,
        output: confirm
          ? `Tool "${pendingToolCall.call.name}" approved by user.`
          : `Tool "${pendingToolCall.call.name}" rejected by user.`,
        is_error: !confirm,
      };

      const stateWithResult = dispatch({ type: 'SET_TOOL_RESULT', toolResult });
      const finalState = dispatch({
        type: confirm ? 'CONFIRM_TOOL' : 'REJECT_TOOL',
        toolCallId,
      });

      if (confirm) {
        await fetchResponse(stateWithResult.session);
        return;
      }

      runtimeDeps.saveSession(finalState.session);
    },
    [dispatch, fetchResponse, runtimeDeps],
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

  return <Layout state={state} dispatch={boundDispatch} />;
}

function handleStreamChunk(
  chunk: StreamChunk,
  dispatch: (action: AppAction) => AppState,
): boolean {
  switch (chunk.type) {
    case 'text':
      dispatch({ type: 'APPEND_TEXT', delta: chunk.delta });
      return false;
    case 'tool_call':
      dispatch({
        type: 'SET_TOOL_CALL',
        toolCall: {
          id: chunk.id,
          name: chunk.name,
          input: normalizeToolInput(chunk.input),
        },
      });
      return true;
    case 'usage':
      dispatch({
        type: 'SET_USAGE',
        inputTokens: chunk.inputTokens,
        outputTokens: chunk.outputTokens,
      });
      return false;
    case 'done':
      return false;
    default:
      return false;
  }
}

function normalizeToolInput(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }

  return { value: input };
}
