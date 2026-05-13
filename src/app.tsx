import React, { useReducer } from 'react';
import { nanoid } from 'nanoid';
import type { AppState, AppAction, Session } from './types.js';
import type { ConfigType } from './schemas.js';
import { Layout } from './ui/Layout.js';

export type { ConfigType };

function makeEmptySession(config: ConfigType): Session {
  const provider = config.default_provider;
  const providerCfg = config.providers[provider];
  return {
    id: nanoid(),
    title: '',
    provider,
    model: providerCfg?.model ?? 'unknown',
    mode: config.default_mode,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_USER_MESSAGE':
      return {
        ...state,
        session: {
          ...state.session,
          messages: [...state.session.messages, action.message],
          updatedAt: Date.now(),
        },
      };

    case 'START_STREAMING':
      return { ...state, status: 'streaming' };

    case 'APPEND_TEXT': {
      const msgs = state.session.messages;
      const last = msgs[msgs.length - 1];
      if (last && last.role === 'assistant') {
        const updated = { ...last, content: last.content + action.delta };
        return {
          ...state,
          session: {
            ...state.session,
            messages: [...msgs.slice(0, -1), updated],
          },
        };
      }
      return state;
    }

    case 'SET_TOOL_CALL':
      return {
        ...state,
        status: 'awaiting-tool-confirm',
        pendingToolCall: { call: action.toolCall },
      };

    case 'SET_TOOL_RESULT':
      return {
        ...state,
        pendingToolCall: state.pendingToolCall
          ? { ...state.pendingToolCall, result: action.toolResult }
          : undefined,
      };

    case 'SET_USAGE': {
      const msgs = state.session.messages;
      const last = msgs[msgs.length - 1];
      if (last) {
        const updated = {
          ...last,
          tokens: action.inputTokens + action.outputTokens,
        };
        return {
          ...state,
          session: {
            ...state.session,
            messages: [...msgs.slice(0, -1), updated],
          },
        };
      }
      return state;
    }

    case 'STOP_STREAMING':
      return { ...state, status: 'idle' };

    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.error };

    case 'CONFIRM_TOOL':
    case 'REJECT_TOOL':
      return { ...state, status: 'idle', pendingToolCall: undefined };

    default:
      return state;
  }
}

interface AppProps {
  config: ConfigType;
}

export function App({ config }: AppProps) {
  const initialState: AppState = {
    session: makeEmptySession(config),
    status: 'idle',
    pendingToolCall: undefined,
  };

  const [state, dispatch] = useReducer(reducer, initialState);

  return <Layout state={state} dispatch={dispatch} />;
}
